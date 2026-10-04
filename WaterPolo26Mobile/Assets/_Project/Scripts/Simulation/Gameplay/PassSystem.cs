using System;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>Pass target selection (assisted / standard / pro) and pass execution.</summary>
    public static class PassSystem
    {
        public const float MinPassDistance = 1.5f;
        public const float ReceiveHeight = 0.6f;
        private static readonly float ProConeCos = MathF.Cos(35f * FMath.Deg2Rad);

        /// <summary>
        /// Scores how good a pass to <paramref name="target"/> is. Higher is better.
        /// Returns float.MinValue for impossible targets.
        /// </summary>
        public static float Evaluate(MatchSimulation sim, SimPlayer passer, SimPlayer target, Vec3 preferredDir,
            AssistLevel assist, float risk, float centerBonus)
        {
            if (target == passer || target.TeamIndex != passer.TeamIndex) return float.MinValue;
            Vec3 toTarget = (target.Position - passer.Position).Flat;
            float d = toTarget.Magnitude;
            if (d < MinPassDistance) return float.MinValue;

            var cfg = sim.Config;
            float sign = cfg.AttackSign(passer.TeamIndex);
            Vec3 goal = cfg.TargetGoalCenter(passer.TeamIndex);

            float advance = FMath.Clamp((target.Position.X - passer.Position.X) * sign / 10f, -1f, 1f);
            float goalProximity = 1f - FMath.Clamp01(Vec3.FlatDistance(target.Position, goal) / 15f);

            float laneDanger = 0f;
            float receiverPressure = 0f;
            var opponents = sim.Teams[1 - passer.TeamIndex].Players;
            foreach (var o in opponents)
            {
                float dist = Vec3.FlatDistanceToSegment(o.Position, passer.Position, target.Position, out float t);
                if (t > 0.08f && t < 0.95f && dist < 1.6f) laneDanger += (1.6f - dist) / 1.6f;
                float dr = Vec3.FlatDistance(o.Position, target.Position);
                if (dr < 1.6f) receiverPressure = MathF.Max(receiverPressure, (1.6f - dr) / 1.6f);
            }

            risk = MathF.Max(0.3f, risk);
            float score = 0.6f * advance + 0.5f * goalProximity
                          - laneDanger * (1.2f / risk)
                          - receiverPressure * (0.7f / risk)
                          - MathF.Max(0f, d - 9f) / 10f;

            if (target.Slot == 5 && !target.IsGoalkeeper) score += centerBonus * (1f - receiverPressure * 0.5f);
            if (target.IsGoalkeeper) score -= 0.8f;

            if (preferredDir.SqrMagnitude > 0.01f)
            {
                float align = Vec3.Dot(toTarget / d, preferredDir.Flat.Normalized);
                if (assist == AssistLevel.Pro && align < ProConeCos) return float.MinValue;
                float weight = assist == AssistLevel.Assisted ? 0.6f : (assist == AssistLevel.Standard ? 1.5f : 4f);
                score += align * weight;
            }

            return score;
        }

        public static SimPlayer ChooseTarget(MatchSimulation sim, SimPlayer passer, Vec3 preferredDir, AssistLevel assist,
            float risk, float centerBonus, float decisionNoise = 0f)
        {
            SimPlayer best = null;
            float bestScore = float.MinValue;
            foreach (var mate in sim.Teams[passer.TeamIndex].Players)
            {
                float s = Evaluate(sim, passer, mate, preferredDir, assist, risk, centerBonus);
                if (s == float.MinValue) continue;
                if (decisionNoise > 0f) s += sim.Rng.Bell() * decisionNoise;
                if (s > bestScore)
                {
                    bestScore = s;
                    best = mate;
                }
            }

            return best;
        }

        /// <summary>Pass speed in m/s for a pass of the given length.</summary>
        public static float PassSpeed(SimPlayer passer, float distance, bool lob)
        {
            float speed = FMath.Lerp(8f, 12f, passer.EffectivePassing);
            if (distance > 9f) speed += FMath.Lerp(0f, 3.5f, passer.EffectivePower) * FMath.InverseLerp(9f, 18f, distance);
            return lob ? speed * 0.55f : speed;
        }

        /// <summary>Throws the ball toward a team-mate (with lead) or into space when target is null.</summary>
        public static void Execute(MatchSimulation sim, SimPlayer passer, SimPlayer target, Vec3 fallbackDir, bool lob)
        {
            var ball = sim.Ball;
            if (ball.Owner != passer) return;

            Vec3 from = ball.Position;
            Vec3 aim;
            if (target != null)
            {
                float d0 = Vec3.FlatDistance(from, target.Position);
                float est = d0 / PassSpeed(passer, d0, lob);
                Vec3 lead = Vec3.ClampMagnitude(target.Velocity.Flat * est, 2f);
                aim = target.Position + lead;
            }
            else
            {
                Vec3 dir = fallbackDir.SqrMagnitude > 0.01f ? fallbackDir.Flat.Normalized : passer.Facing;
                aim = passer.Position + dir * 8f;
            }

            aim.Y = ReceiveHeight;
            aim.X = FMath.Clamp(aim.X, -sim.Config.HalfLength + 0.5f, sim.Config.HalfLength - 0.5f);
            aim.Z = FMath.Clamp(aim.Z, -sim.Config.HalfWidth + 0.5f, sim.Config.HalfWidth - 0.5f);

            // Accuracy: angular + length error driven by Passing (and fatigue).
            float dist = Vec3.FlatDistance(from, aim);
            float maxErrDeg = FMath.Lerp(7f, 1.5f, passer.EffectivePassing);
            if (sim.IsHuman(passer) && sim.Config.Assist == AssistLevel.Assisted) maxErrDeg *= 0.6f;
            float angle = sim.Rng.Bell() * maxErrDeg * FMath.Deg2Rad;
            Vec3 dirFlat = (aim - from).Flat.Normalized;
            float c = MathF.Cos(angle), s = MathF.Sin(angle);
            Vec3 rotated = new Vec3(dirFlat.X * c - dirFlat.Z * s, 0f, dirFlat.X * s + dirFlat.Z * c);
            float lengthErr = 1f + sim.Rng.Bell() * (1f - passer.EffectivePassing) * 0.08f;
            Vec3 finalAim = from.Flat + rotated * (dist * lengthErr);
            finalAim.Y = ReceiveHeight;

            float speed = PassSpeed(passer, dist, lob);
            Vec3 velocity = BallPhysics.BallisticVelocity(from, finalAim, speed, out _);

            ball.Passer = passer;
            ball.IntendedReceiver = target;
            ball.Release(BallState.Passed, velocity);
            passer.ActionCooldown = 0.35f;
            sim.OnPassMade(passer, target);
        }
    }
}
