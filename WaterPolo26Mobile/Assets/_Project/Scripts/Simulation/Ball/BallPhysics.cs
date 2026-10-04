using System;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    public enum BoundaryResult
    {
        None,
        /// <summary>Ball fully crossed the goal line inside the frame. Side = goal at +X (1) or -X (0).</summary>
        Goal,
        /// <summary>Ball hit a post or the crossbar and bounced back into play.</summary>
        Frame,
        /// <summary>Ball crossed the goal line outside the frame.</summary>
        OutGoalLine,
        /// <summary>Ball left the field of play on a side.</summary>
        OutSide,
    }

    /// <summary>
    /// Ball flight in the air, skipping on the water, floating with water drag,
    /// and detection against goals and field limits.
    /// </summary>
    public static class BallPhysics
    {
        public const float Gravity = 9.81f;
        public const float AirDrag = 0.03f;
        public const float WaterDrag = 1.7f;
        /// <summary>Downward speed above which a ball skips on the water instead of landing.</summary>
        public const float SkipSpeed = 2.5f;

        public static bool IsOnWater(SimBall b) => b.Position.Y <= SimBall.Radius + 0.005f && MathF.Abs(b.Velocity.Y) < 0.01f;

        public static void Integrate(SimBall b, float dt)
        {
            if (b.State == BallState.Possessed) return;

            bool airborne = b.Position.Y > SimBall.Radius + 0.005f || b.Velocity.Y > 0.01f;
            Vec3 v = b.Velocity;
            if (airborne)
            {
                v.Y -= Gravity * dt;
                v = v * (1f - AirDrag * dt);
            }

            Vec3 p = b.Position + v * dt;

            if (p.Y <= SimBall.Radius)
            {
                p.Y = SimBall.Radius;
                if (v.Y < -SkipSpeed)
                {
                    // Skip: part of the vertical energy is returned, the water steals some horizontal speed.
                    v.Y = -v.Y * 0.3f;
                    v.X *= 0.85f;
                    v.Z *= 0.85f;
                }
                else
                {
                    v.Y = 0f;
                }
            }

            if (p.Y <= SimBall.Radius + 0.005f && MathF.Abs(v.Y) < 0.01f)
            {
                float k = MathF.Max(0f, 1f - WaterDrag * dt);
                v.X *= k;
                v.Z *= k;
            }

            b.Position = p;
            b.Velocity = v;
            b.StateTime += dt;
        }

        /// <summary>
        /// Checks the movement prev -> current against goal lines and side lines.
        /// On a frame hit the ball is bounced back and stays in play.
        /// </summary>
        public static BoundaryResult CheckBoundaries(SimBall b, Vec3 prev, MatchConfig cfg, out int goalSide)
        {
            goalSide = -1;
            float hl = cfg.HalfLength;
            float r = SimBall.Radius;

            for (int side = 0; side < 2; side++)
            {
                float lineX = side == 1 ? hl : -hl;
                float sign = side == 1 ? 1f : -1f;
                // The ball is "over the line" once it has entirely crossed it.
                float prevDepth = (prev.X - lineX) * sign;
                float depth = (b.Position.X - lineX) * sign;
                if (!(prevDepth <= r && depth > r)) continue;

                float t = (r - prevDepth) / MathF.Max(1e-5f, depth - prevDepth);
                Vec3 cross = Vec3.Lerp(prev, b.Position, t);
                float az = MathF.Abs(cross.Z);
                float halfGoal = cfg.GoalWidth * 0.5f;

                bool insideMouth = az < halfGoal - r && cross.Y < cfg.GoalHeight - r;
                bool hitsPost = az >= halfGoal - r && az <= halfGoal + r && cross.Y < cfg.GoalHeight + r;
                bool hitsBar = az < halfGoal + r && cross.Y >= cfg.GoalHeight - r && cross.Y <= cfg.GoalHeight + r;

                goalSide = side;
                if (insideMouth)
                {
                    // Into the net: stop the ball inside the goal.
                    b.Position = new Vec3(lineX + sign * MathF.Min(cfg.GoalDepth, r * 3f), MathF.Max(r, cross.Y), cross.Z);
                    b.Velocity = Vec3.Zero;
                    return BoundaryResult.Goal;
                }

                if (hitsPost || hitsBar)
                {
                    Vec3 v = b.Velocity;
                    v.X = -v.X * 0.45f;
                    if (hitsPost) v.Z = -v.Z * 0.5f + MathF.Sign(cross.Z) * MathF.Abs(v.X) * 0.4f;
                    else v.Y = -MathF.Abs(v.Y) * 0.4f;
                    b.Velocity = v;
                    b.Position = new Vec3(lineX - sign * (r + 0.02f), cross.Y, cross.Z);
                    return BoundaryResult.Frame;
                }

                return BoundaryResult.OutGoalLine;
            }

            if (MathF.Abs(b.Position.Z) > cfg.HalfWidth + r)
            {
                goalSide = -1;
                return BoundaryResult.OutSide;
            }

            return BoundaryResult.None;
        }

        /// <summary>
        /// Velocity that sends the ball from <paramref name="from"/> to <paramref name="to"/>
        /// with the given horizontal speed (gravity included, drag ignored).
        /// </summary>
        public static Vec3 BallisticVelocity(Vec3 from, Vec3 to, float horizontalSpeed, out float flightTime)
        {
            Vec3 d = to - from;
            Vec3 flat = d.Flat;
            float dist = flat.Magnitude;
            horizontalSpeed = MathF.Max(1f, horizontalSpeed);
            flightTime = MathF.Max(0.05f, dist / horizontalSpeed);
            float vy = (d.Y + 0.5f * Gravity * flightTime * flightTime) / flightTime;
            Vec3 h = dist > 1e-4f ? flat / dist * horizontalSpeed : Vec3.Zero;
            return new Vec3(h.X, vy, h.Z);
        }
    }
}
