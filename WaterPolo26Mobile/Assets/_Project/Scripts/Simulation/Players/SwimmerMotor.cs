using System;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>
    /// Aquatic locomotion: velocity eases toward the desired velocity (inertia),
    /// water drag slows the swimmer when there is no input, turning is rate-limited,
    /// sprint costs stamina, fatigue reduces top speed.
    /// </summary>
    public static class SwimmerMotor
    {
        public const float SprintMultiplier = 1.35f;
        public const float BallCarrySpeedFactor = 0.82f;
        public const float SprintUnlockStamina = 0.2f;
        public const float SprintMinStamina = 0.03f;

        public static float BaseMaxSpeed(SimPlayer p) => FMath.Lerp(1.15f, 1.65f, PlayerStats.N(p.Stats.Speed));
        public static float Acceleration(SimPlayer p) => FMath.Lerp(1.6f, 3.6f, PlayerStats.N(p.Stats.Acceleration));
        public static float TurnRate(SimPlayer p) => FMath.Lerp(200f, 420f, PlayerStats.N(p.Stats.Technique)) * FMath.Deg2Rad;

        public static float SprintDrainPerSecond(SimPlayer p) => FMath.Lerp(0.085f, 0.045f, PlayerStats.N(p.Stats.Stamina));
        public static float RecoveryPerSecond(SimPlayer p) => FMath.Lerp(0.03f, 0.065f, PlayerStats.N(p.Stats.Stamina));

        /// <summary>
        /// Current speed cap given sprint, fatigue and ball possession.
        /// </summary>
        public static float MaxSpeed(SimPlayer p, bool hasBall)
        {
            float s = BaseMaxSpeed(p) * p.FatigueSpeedFactor;
            if (p.IsSprinting) s *= SprintMultiplier;
            if (hasBall) s *= FMath.Lerp(BallCarrySpeedFactor, 0.92f, PlayerStats.N(p.Stats.Technique));
            return s;
        }

        /// <param name="move">Desired flat direction, magnitude in [0, 1].</param>
        public static void Step(SimPlayer p, Vec3 move, bool wantsSprint, bool hasBall, float dt)
        {
            move = Vec3.ClampMagnitude(move.Flat, 1f);
            float moveAmount = move.Magnitude;

            UpdateStamina(p, wantsSprint && moveAmount > 0.2f, moveAmount, dt);

            float maxSpeed = MaxSpeed(p, hasBall);
            if (p.StunTimer > 0f) maxSpeed *= 0.35f;

            Vec3 desired = move * maxSpeed;
            float accel = Acceleration(p) * (p.IsSprinting ? 1.2f : 1f);
            // Reversing direction in water is harder than continuing: use less authority
            // when the desired velocity opposes the current one.
            if (Vec3.Dot(desired, p.Velocity) < 0f) accel *= 0.75f;
            // Without input, water drag (not the swimmer) slows the player down.
            if (moveAmount < 0.05f) accel = 2.2f;

            p.Velocity = Vec3.MoveTowards(p.Velocity.Flat, desired, accel * dt);
            p.Position = p.Position + p.Velocity * dt;
            p.Position.Y = 0f;

            Vec3 faceTarget = moveAmount > 0.1f ? move.Normalized : p.Facing;
            p.Facing = Vec3.RotateFlatTowards(p.Facing, faceTarget, TurnRate(p) * dt);
        }

        public static void FaceTowards(SimPlayer p, Vec3 point, float dt)
        {
            Vec3 dir = (point - p.Position).Flat;
            if (dir.SqrMagnitude < 1e-4f) return;
            p.Facing = Vec3.RotateFlatTowards(p.Facing, dir.Normalized, TurnRate(p) * dt);
        }

        private static void UpdateStamina(SimPlayer p, bool wantsSprint, float moveAmount, float dt)
        {
            if (p.SprintLocked && p.Stamina >= SprintUnlockStamina) p.SprintLocked = false;

            p.IsSprinting = wantsSprint && !p.SprintLocked && p.Stamina > SprintMinStamina;

            if (p.IsSprinting)
            {
                p.Stamina -= SprintDrainPerSecond(p) * dt;
                if (p.Stamina <= SprintMinStamina)
                {
                    p.Stamina = Math.Max(0f, p.Stamina);
                    p.SprintLocked = true;
                    p.IsSprinting = false;
                }
            }
            else
            {
                // Swimming at cruise speed recovers slowly; treading water recovers faster.
                float recovery = RecoveryPerSecond(p) * FMath.Lerp(1f, 0.35f, moveAmount);
                p.Stamina = Math.Min(1f, p.Stamina + recovery * dt);
            }
        }
    }
}
