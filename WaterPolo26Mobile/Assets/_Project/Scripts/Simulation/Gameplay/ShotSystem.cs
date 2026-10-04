using System;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    public enum TimingQuality
    {
        /// <summary>Timing mechanic disabled or not applicable (quick shot, AI).</summary>
        None,
        Poor,
        Good,
        Excellent,
    }

    /// <summary>
    /// Optional timing mechanic: while charging, a sweet spot is shown on the charge bar.
    /// Releasing inside it tightens the shot, releasing far from it widens it.
    /// </summary>
    public static class ShotTiming
    {
        /// <summary>Seconds to go from 0 to full charge.</summary>
        public const float ChargeTime = 0.9f;
        public const float ExcellentMin = 0.72f;
        public const float ExcellentMax = 0.86f;
        public const float GoodMin = 0.5f;
        /// <summary>Holding a full charge longer than this counts as a poor release.</summary>
        public const float MaxHoldAtFull = 0.5f;

        public static TimingQuality Evaluate(float charge, float heldAtMax)
        {
            if (heldAtMax > MaxHoldAtFull) return TimingQuality.Poor;
            if (charge >= ExcellentMin && charge <= ExcellentMax) return TimingQuality.Excellent;
            if (charge >= GoodMin) return TimingQuality.Good;
            return TimingQuality.Poor;
        }

        public static float ErrorMultiplier(TimingQuality q)
        {
            switch (q)
            {
                case TimingQuality.Excellent: return 0.5f;
                case TimingQuality.Poor: return 1.6f;
                default: return 1f;
            }
        }
    }

    public static class ShotSystem
    {
        public const float QuickShotCharge = 0.45f;
        public const float AimMargin = 0.22f;

        /// <summary>Release speed in m/s. Elite shots reach ~20 m/s.</summary>
        public static float ShotSpeed(SimPlayer shooter, float charge)
        {
            float c = MathF.Pow(FMath.Clamp01(charge), 0.8f);
            return FMath.Lerp(10.5f, 17f, c) * FMath.Lerp(0.82f, 1.18f, shooter.EffectivePower);
        }

        /// <summary>
        /// Base dispersion amplitude (metres at 7 m) from Accuracy + Shooting.
        /// Applied with DeterministicRandom.Bell(), whose standard deviation is ~1/3 of this amplitude.
        /// </summary>
        public static float BaseSpread(SimPlayer shooter)
        {
            float skill = 0.65f * shooter.EffectiveAccuracy + 0.35f * shooter.EffectiveShooting;
            return 0.45f + (1f - skill) * 1.6f;
        }

        /// <summary>Automatic target: the corner away from the goalkeeper.</summary>
        public static Vec3 AutoAimPoint(MatchSimulation sim, SimPlayer shooter)
        {
            var cfg = sim.Config;
            Vec3 goal = cfg.TargetGoalCenter(shooter.TeamIndex);
            SimPlayer gk = sim.Teams[1 - shooter.TeamIndex].Goalkeeper;
            float half = cfg.GoalWidth * 0.5f - AimMargin - 0.1f;
            float gkZ = gk != null ? gk.Position.Z : 0f;
            float z = gkZ > goal.Z ? -half : half;
            if (MathF.Abs(gkZ - goal.Z) < 0.15f) z = sim.Rng.Chance(0.5f) ? half : -half;
            float y = sim.Rng.Chance(0.5f) ? 0.3f : 0.65f;
            return new Vec3(goal.X, y, z);
        }

        /// <summary>Target from an explicit aim (AimX lateral, AimY height), mapped onto the goal mouth.</summary>
        public static Vec3 AimPoint(MatchSimulation sim, SimPlayer shooter, float aimX, float aimY)
        {
            var cfg = sim.Config;
            Vec3 goal = cfg.TargetGoalCenter(shooter.TeamIndex);
            // "Right" as seen by the shooter facing the goal.
            float sign = cfg.AttackSign(shooter.TeamIndex);
            float lateral = -sign * FMath.Clamp(aimX, -1.3f, 1.3f) * (cfg.GoalWidth * 0.5f);
            float y = FMath.Lerp(0.2f, cfg.GoalHeight - 0.1f, aimY);
            return new Vec3(goal.X, y, goal.Z + lateral);
        }

        public static void Execute(MatchSimulation sim, SimPlayer shooter, float charge, TimingQuality timing, PlayerCommand cmd)
        {
            var ball = sim.Ball;
            if (ball.Owner != shooter) return;
            var cfg = sim.Config;
            bool human = sim.IsHuman(shooter);
            // The AI gets no frame clamp: its misses come from its own stats.
            AssistLevel assist = human ? cfg.Assist : AssistLevel.Pro;

            Vec3 target = cmd.HasAim ? AimPoint(sim, shooter, cmd.AimX, cmd.AimY) : AutoAimPoint(sim, shooter);

            Vec3 from = ball.Position;
            float dist = Vec3.FlatDistance(from, target);

            float spread = BaseSpread(shooter) * (dist / 7f) * ShotTiming.ErrorMultiplier(timing);
            if (charge > 0.92f) spread *= 1.25f;
            if (cmd.QuickShot) spread *= 1.3f;
            spread *= 1f + sim.NearestOpponentPressure(shooter) * 0.5f;
            if (human && assist == AssistLevel.Assisted) spread *= 0.75f;

            target.Z += sim.Rng.Bell() * spread;
            target.Y += sim.Rng.Bell() * spread * 0.7f;

            // Assistance keeps the aim inside the frame.
            Vec3 goal = cfg.TargetGoalCenter(shooter.TeamIndex);
            float half = cfg.GoalWidth * 0.5f;
            if (assist == AssistLevel.Assisted)
            {
                target.Z = FMath.Clamp(target.Z, goal.Z - half + AimMargin, goal.Z + half - AimMargin);
                target.Y = FMath.Clamp(target.Y, 0.15f, cfg.GoalHeight - AimMargin);
            }
            else if (assist == AssistLevel.Standard)
            {
                target.Z = FMath.Clamp(target.Z, goal.Z - half - 0.15f, goal.Z + half + 0.15f);
                target.Y = FMath.Clamp(target.Y, 0.1f, cfg.GoalHeight + 0.15f);
            }
            target.Y = MathF.Max(target.Y, 0.05f);

            float speed = ShotSpeed(shooter, charge);
            if (cmd.LobShot)
            {
                speed = 7f;
                target.Y = FMath.Clamp(target.Y, 0.55f, cfg.GoalHeight - 0.12f);
            }

            // Aim slightly past the line so the ball fully crosses it.
            Vec3 past = target + new Vec3(cfg.AttackSign(shooter.TeamIndex) * 0.4f, 0f, 0f);
            Vec3 velocity = BallPhysics.BallisticVelocity(from, past, speed, out _);

            ball.Shooter = shooter;
            ball.IntendedReceiver = null;
            ball.Release(BallState.Shot, velocity);
            shooter.ActionCooldown = 0.5f;
            sim.OnShotTaken(shooter, timing, charge);
        }
    }
}
