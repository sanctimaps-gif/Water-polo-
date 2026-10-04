using System;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>
    /// Goalkeeper brain and save model.
    /// Stats used: Reaction (réflexes), Positioning (placement), Intelligence (anticipation),
    /// Goalkeeping (plongeon / reach), Power (clearance distance), Passing (relance).
    /// </summary>
    public static class GoalkeeperAI
    {
        public const float ArmReach = 0.6f;
        public const float HandHeight = 0.45f;

        public static float Norm(SimPlayer gk) => PlayerStats.N(gk.Stats.Goalkeeping);

        public static float ReactionDelay(SimPlayer gk, float skillScale)
        {
            float reflex = (PlayerStats.N(gk.Stats.Reaction) + Norm(gk)) * 0.5f * skillScale;
            return FMath.Lerp(0.34f, 0.1f, reflex);
        }

        public static float DiveSpeed(SimPlayer gk) => FMath.Lerp(1.8f, 3.4f, Norm(gk));
        public static float MaxDive(SimPlayer gk) => FMath.Lerp(0.7f, 1.3f, Norm(gk));

        public static void Think(MatchSimulation sim, SimPlayer gk, float dt)
        {
            var cmd = new PlayerCommand();
            var cfg = sim.Config;
            var ball = sim.Ball;
            Vec3 goal = cfg.OwnGoalCenter(gk.TeamIndex);
            float sign = cfg.AttackSign(gk.TeamIndex);

            if (ball.Owner == gk)
            {
                // Relance: look for an outlet after a short hold.
                if (gk.PossessionTime > 0.8f && gk.ActionCooldown <= 0f)
                {
                    SimPlayer target = PassSystem.ChooseTarget(sim, gk, Vec3.Zero, AssistLevel.Standard, 0.8f, 0f,
                        (1f - PlayerStats.N(gk.Stats.Intelligence)) * 0.3f);
                    if (target != null || gk.PossessionTime > 3f)
                    {
                        cmd.Pass = true;
                        cmd.PassDirection = target != null ? (target.Position - gk.Position).Flat.Normalized : new Vec3(sign, 0f, 0f);
                    }
                }
                cmd.Move = FieldPlayerAI.Steer(gk, goal + new Vec3(sign * 1f, 0f, 0f), 0.3f);
                gk.Command = cmd;
                return;
            }

            // Loose ball close to the goal and nobody closer: go and claim it.
            if (ball.IsLoose && Vec3.FlatDistance(ball.Position, goal) < 3.5f && sim.IsAmongClosestToBall(gk, 1, anyTeam: true))
            {
                cmd.Move = FieldPlayerAI.Steer(gk, ball.Position, 0f);
                cmd.Sprint = true;
                gk.Command = cmd;
                return;
            }

            Vec3 desired;
            if (ball.State == BallState.Shot && ball.Shooter != null && ball.Shooter.TeamIndex != gk.TeamIndex)
            {
                // Dive toward the predicted crossing point once the reaction delay is over.
                if (ball.StateTime >= ReactionDelay(gk, sim.SkillScale(gk.TeamIndex)) && PredictCrossing(ball, gk.Position.X, out Vec3 cross))
                    desired = new Vec3(gk.Position.X, 0f, cross.Z);
                else
                    desired = gk.Position;
                cmd.Move = FieldPlayerAI.Steer(gk, desired, 0f);
                cmd.Sprint = true;
                gk.Command = cmd;
                return;
            }

            // Positioning on the ball–goal line, anticipation uses ball velocity.
            float anticipation = PlayerStats.N(gk.Stats.Intelligence);
            Vec3 b = ball.Position.Flat + ball.Velocity.Flat * (0.3f * anticipation);
            Vec3 toBall = (b - goal).Flat;
            float distBall = toBall.Magnitude;
            float depth = FMath.Lerp(0.6f, 1.3f, FMath.InverseLerp(3f, 12f, distBall));
            desired = goal + (distBall > 0.01f ? toBall / distBall : new Vec3(sign, 0f, 0f)) * depth;
            float posErr = (1f - PlayerStats.N(gk.Stats.Positioning)) * 0.45f;
            desired.Z = desired.Z * (1f - posErr);
            float limit = cfg.GoalWidth * 0.5f + 0.1f;
            desired.Z = FMath.Clamp(desired.Z, goal.Z - limit, goal.Z + limit);
            desired.X = goal.X + sign * MathF.Max(0.4f, (desired.X - goal.X) * sign);

            cmd.Move = FieldPlayerAI.Steer(gk, desired, 0.2f);
            gk.Command = cmd;
        }

        /// <summary>Linear prediction (with gravity) of where the ball crosses the plane x = planeX.</summary>
        public static bool PredictCrossing(SimBall ball, float planeX, out Vec3 point)
        {
            point = ball.Position;
            float vx = ball.Velocity.X;
            if (MathF.Abs(vx) < 0.1f) return false;
            float t = (planeX - ball.Position.X) / vx;
            if (t < 0f || t > 3f) return false;
            float y = ball.Position.Y + ball.Velocity.Y * t - 0.5f * BallPhysics.Gravity * t * t;
            point = new Vec3(planeX, MathF.Max(SimBall.Radius, y), ball.Position.Z + ball.Velocity.Z * t);
            return true;
        }

        public enum SaveOutcome { NoAttempt, Missed, Caught, Parried }

        /// <summary>
        /// Resolves a save when the shot reaches the goalkeeper's plane. Deterministic given the RNG state.
        /// </summary>
        public static SaveOutcome ResolveSave(MatchSimulation sim, SimPlayer gk, SimBall ball)
        {
            var cfg = sim.Config;
            Vec3 goal = cfg.OwnGoalCenter(gk.TeamIndex);
            float half = cfg.GoalWidth * 0.5f;

            // Shots clearly off target are left alone.
            if (!PredictCrossing(ball, goal.X, out Vec3 atLine)) return SaveOutcome.NoAttempt;
            if (MathF.Abs(atLine.Z - goal.Z) > half + 0.25f || atLine.Y > cfg.GoalHeight + 0.25f) return SaveOutcome.NoAttempt;

            float skill = sim.SkillScale(gk.TeamIndex);
            float available = MathF.Max(0f, ball.StateTime - ReactionDelay(gk, skill));
            float reach = ArmReach + MathF.Min(available * DiveSpeed(gk) * skill, MaxDive(gk));

            float dz = ball.Position.Z - gk.Position.Z;
            float dy = MathF.Max(0f, ball.Position.Y - HandHeight) * 1.25f; // high balls are harder
            float gap = MathF.Sqrt(dz * dz + dy * dy);
            if (gap > reach) return SaveOutcome.Missed;

            float speed = ball.Velocity.Magnitude;
            float ratio = gap / reach;
            float pSave = 0.9f - ratio * ratio * 0.7f - MathF.Max(0f, speed - 14f) * 0.04f
                          + PlayerStats.N(gk.Stats.Positioning) * 0.05f;
            pSave = FMath.Clamp(pSave * FMath.Lerp(0.85f, 1.05f, Norm(gk) * skill), 0.05f, 0.95f);

            if (!sim.Rng.Chance(pSave)) return SaveOutcome.Missed;

            bool canCatch = speed < FMath.Lerp(10f, 14f, Norm(gk)) && ratio < 0.6f;
            return canCatch && sim.Rng.Chance(0.7f) ? SaveOutcome.Caught : SaveOutcome.Parried;
        }
    }
}
