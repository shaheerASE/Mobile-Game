import Phaser from 'phaser';
import {
  COLORS,
  ENEMY_POOL_MAX,
  GEM,
  PROJECTILE,
  WORLD,
  computeCoins,
  computeScore,
  xpForLevel
} from '../config/GameConfig';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Gem } from '../entities/Gem';
import { Pool } from '../systems/Pool';
import { Spawner } from '../systems/Spawner';
import { WeaponSystem } from '../systems/WeaponSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { backend } from '../services/Backend';
import type { RunConfig, RunResult, UpgradeKind } from '../types';

/** Payload broadcast to the HUD scene each frame. */
export interface HudState {
  timeMs: number;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  kills: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Pool<Enemy>;
  private projectiles!: Pool<Projectile>;
  private gems!: Pool<Gem>;
  private spawner!: Spawner;
  private weapons!: WeaponSystem;
  private joystick!: VirtualJoystick;

  private readonly playerPos = new Phaser.Math.Vector2();

  // Run state
  private elapsedMs = 0;
  private kills = 0;
  private level = 1;
  private xp = 0;
  private xpToNext = xpForLevel(1);
  private levelingUp = false;
  private gameOver = false;
  private runConfig: RunConfig | null = null;

  constructor() {
    super('Game');
  }

  init(data: { runConfig?: RunConfig }): void {
    this.runConfig = data?.runConfig ?? null;
  }

  create(): void {
    this.resetRunState();

    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.drawGrid();

    this.player = new Player(
      this,
      WORLD.width / 2,
      WORLD.height / 2,
      this.runConfig ?? undefined
    );
    this.playerPos.set(this.player.x, this.player.y);

    this.enemies = new Pool(this, Enemy, ENEMY_POOL_MAX);
    this.projectiles = new Pool(this, Projectile, PROJECTILE.poolMax);
    this.gems = new Pool(this, Gem, GEM.poolMax);

    this.spawner = new Spawner(this.enemies, this.playerPos);
    this.weapons = new WeaponSystem(this.player, this.enemies, this.projectiles);
    this.joystick = new VirtualJoystick(this);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.setupCollisions();

    if (this.scene.isActive('HUD')) this.scene.stop('HUD');
    this.scene.launch('HUD');

    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
  }

  private resetRunState(): void {
    const startLevel = this.runConfig?.startLevel ?? 1;
    this.elapsedMs = 0;
    this.kills = 0;
    this.level = startLevel;
    this.xp = 0;
    this.xpToNext = xpForLevel(startLevel);
    this.levelingUp = false;
    this.gameOver = false;
  }

  private setupCollisions(): void {
    this.physics.add.overlap(
      this.projectiles.group,
      this.enemies.group,
      this.onProjectileHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.enemies.group,
      this.onPlayerHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
  }

  private onProjectileHitEnemy = (obj1: unknown, obj2: unknown): void => {
    const proj = obj1 as Projectile;
    const enemy = obj2 as Enemy;
    if (!proj.active || !enemy.active) return;

    const killed = enemy.takeDamage(proj.damage);
    proj.deactivate();

    if (killed) {
      this.kills++;
      this.dropGem(enemy.x, enemy.y, enemy.xpValue);
      enemy.deactivate();
    }
  };

  private onPlayerHitEnemy = (_obj1: unknown, obj2: unknown): void => {
    const enemy = obj2 as Enemy;
    if (!enemy.active || this.gameOver) return;
    this.player.takeDamage(enemy.contactDamage, this.time.now);
    if (this.player.isDead) void this.endRun();
  };

  private dropGem(x: number, y: number, xp: number): void {
    const gem = this.gems.obtain();
    if (!gem) return;
    gem.spawn(
      x,
      y,
      xp,
      this.playerPos,
      () => this.player.stats.pickupRadius,
      (g) => this.collectGem(g)
    );
  }

  private collectGem(gem: Gem): void {
    const xp = gem.xpValue;
    gem.deactivate();
    this.gainXp(xp);
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    if (!this.levelingUp) this.checkLevelUp();
  }

  private checkLevelUp(): void {
    if (this.xp < this.xpToNext) return;
    this.xp -= this.xpToNext;
    this.level++;
    this.xpToNext = xpForLevel(this.level);
    this.levelingUp = true;

    const choices = UpgradeSystem.rollChoices(this.player);
    this.scene.pause();
    this.scene.launch('LevelUp', { choices });
  }

  onUpgradeChosen(kind: UpgradeKind): void {
    UpgradeSystem.apply(this.player, kind);
    this.levelingUp = false;
  }

  private onResume(): void {
    if (!this.levelingUp) this.checkLevelUp();
  }

  private async endRun(): Promise<void> {
    if (this.gameOver) return;
    this.gameOver = true;
    this.player.setVelocity(0, 0);
    this.scene.stop('HUD');

    const greedMult = this.runConfig?.greedMult ?? 1;
    const durationSeconds = Math.floor(this.elapsedMs / 1000);
    // Display-only estimate — shown when the server can't be reached. Never
    // committed locally; the server is authoritative for the real total.
    const displayEstimate = computeCoins(this.elapsedMs, this.kills, this.level, greedMult);

    // Rewards are computed server-side; on failure the run is queued offline.
    const outcome = await backend.submitRun(durationSeconds, this.kills, this.level);

    const result: RunResult = {
      survivedMs: this.elapsedMs,
      kills: this.kills,
      level: this.level,
      score: computeScore(this.elapsedMs, this.kills, this.level),
      coinsEarned: outcome.isOffline ? displayEstimate : outcome.coins,
      serverCoins: outcome.isOffline ? undefined : outcome.coins,
      serverXp: outcome.isOffline ? undefined : outcome.xp,
      isOffline: outcome.isOffline
    };

    this.scene.launch('GameOver', result);
    this.scene.pause();
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.levelingUp) return;

    this.elapsedMs += delta;
    this.player.move(this.joystick.vector.x, this.joystick.vector.y);
    this.playerPos.set(this.player.x, this.player.y);
    this.weapons.update(delta);
    this.spawner.update(delta, this.elapsedMs);
    this.broadcastHud();
  }

  private broadcastHud(): void {
    const state: HudState = {
      timeMs: this.elapsedMs,
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hp: this.player.hp,
      maxHp: this.player.stats.maxHp,
      kills: this.kills
    };
    this.events.emit('hud', state);
  }

  private drawGrid(): void {
    const g = this.add.graphics();
    g.lineStyle(2, COLORS.grid, 1);
    const step = 120;
    for (let x = 0; x <= WORLD.width; x += step) g.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += step) g.lineBetween(0, y, WORLD.width, y);
    g.setDepth(-1);

    const border = this.add.graphics();
    border.lineStyle(6, COLORS.player, 0.25);
    border.strokeRect(0, 0, WORLD.width, WORLD.height);
    border.setDepth(-1);
  }
}
