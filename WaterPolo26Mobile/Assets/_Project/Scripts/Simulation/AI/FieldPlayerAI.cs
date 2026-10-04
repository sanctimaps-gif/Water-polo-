using System;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>
    /// Field player brain. Produces a PlayerCommand like a human would.
    /// Heavy decisions (shoot / pass / steal) run at an interval that depends on
    /// Intelligence; steering toward the chosen spot runs every tick.
    /// Reads: ball, team-mates, opponents, space, danger (pressure), score, clocks, tactic, personality.
    /// </summary>
    public static class FieldPlayerAI
    {
        public static void Think(MatchSimulation sim, SimPlayer p, float dt)
        {
            var cmd = new PlayerCommand();
            var ball = sim.Ball;
            var tactic = sim.Teams[p.TeamIndex].TacticParams;
            float intel = PlayerStats.N(p.Stats.Intelligence) * sim.SkillScale(p.TeamIndex);
            bool decide = sim.Time >= p.NextDecisionTime;
            if (decide) p.NextDecisionTime = sim.Time + DecisionInterval(intel) + (p.Id % 3) * 0.02f;

            if (ball.Owner == p)
            {
                CarrierLogic(sim, p, ref cmd, decide, tactic, intel);
            }
            else if (IsLoose(ball) && sim.IsAmongClosestToBall(p, 2))
            {
                Vec3 predicted = ball.Position.Flat + ball.Velocity.Flat * 0.35f;
                cmd.Move = Steer(p, predicted, 0.1f);
                cmd.Sprint = true;
            }
            else if (sim.TeamInPossession == p.TeamIndex)
            {
                SupportLogic(sim, p, ref cmd, decide, tactic);
            }
            else
            {
                DefenseLogic(sim, p, ref cmd, decide, tactic);
            }

            p.Command = cmd;
        }

        private static bool IsLoose(SimBall ball) =>
            ball.State == BallState.Free || ball.State == BallState.Deflected || ball.State == BallState.Blocked;

        // ------------------------------------------------------------------ attack with ball

        private static void CarrierLogic(MatchSimulation sim, SimPlayer p, ref PlayerCommand cmd, bool decide, TacticParams tactic, float intel)
        {
            var cfg = sim.Config;
            Vec3 goal = cfg.TargetGoalCenter(p.TeamIndex);

            // Continue a shot wind-up already started.
            if (p.AiShotTargetCharge >= 0f)
            {
                cmd.Move = Steer(p, goal, 0f) * 0.2f;
                if (p.ShotCharge < p.AiShotTargetCharge)
                {
                    cmd.ShootHeld = true;
                }
                else
                {
                    cmd.ShootHeld = false;
                    p.AiShotTargetCharge = -1f;
                }
                return;
            }

            float distGoal = Vec3.FlatDistance(p.Position, goal);
            float pressure = sim.NearestOpponentPressure(p);

            if (decide && p.ActionCooldown <= 0f)
            {
                float quality = ShotQuality(sim, p);
                float threshold = 0.5f + tactic.ShootThresholdOffset + p.Profile.ShootThresholdOffset;
                if (sim.Rules.ShotClockRemaining < 5f) threshold -= 0.3f;
                // Score context: chasing the game late pushes for shots, protecting a lead slows down.
                int diff = sim.Teams[p.TeamIndex].Score - sim.Teams[1 - p.TeamIndex].Score;
                bool late = sim.Rules.Period >= cfg.Periods && sim.Rules.PeriodTimeRemaining < cfg.PeriodDuration * 0.35f;
                if (late && diff < 0) threshold -= 0.08f;
                if (late && diff > 0) threshold += 0.05f;

                if (quality > threshold)
                {
                    // Good players aim their release inside the timing sweet spot.
                    float aimCharge = FMath.Lerp(ShotTiming.ExcellentMin, ShotTiming.ExcellentMax, sim.Rng.NextFloat());
                    float wobble = (1f - intel) * 0.25f * sim.Rng.Bell();
                    p.AiShotTargetCharge = FMath.Clamp(aimCharge + wobble, 0.35f, 1f);
                    cmd.ShootHeld = true;
                    return;
                }

                float holdLimit = FMath.Lerp(1.0f, 2.2f, sim.Rng.NextFloat()) * tactic.Tempo * p.Profile.Patience;
                bool mustRelease = p.PossessionTime > holdLimit || pressure > 0.55f || sim.Rules.ShotClockRemaining < 3f;
                if (mustRelease || sim.Rng.Chance(0.15f + p.Profile.PassPreference))
                {
                    float noise = (1f - intel) * 0.45f;
                    float risk = p.Profile.PassRisk;
                    SimPlayer target = PassSystem.ChooseTarget(sim, p, Vec3.Zero, AssistLevel.Standard, risk, tactic.CenterFeedBonus, noise);
                    if (target != null)
                    {
                        float score = PassSystem.Evaluate(sim, p, target, Vec3.Zero, AssistLevel.Standard, risk, tactic.CenterFeedBonus);
                        if (mustRelease || score > 0.25f)
                        {
                            cmd.Pass = true;
                            cmd.PassDirection = (target.Position - p.Position).Flat.Normalized;
                            cmd.LobPass = sim.LaneBlocked(p, target) && sim.Rng.Chance(0.6f);
                            p.AiTarget = target.Position;
                            return;
                        }
                    }
                }
            }

            // Swim the ball forward: counter-attack drive when far, settle in the slot when close.
            Vec3 dest = distGoal > 9f ? goal : Formation.AttackSpot(cfg, p.TeamIndex, p.Slot, tactic);
            if (distGoal < 7f && pressure < 0.3f) dest = goal; // space in front: attack the goal
            cmd.Move = Steer(p, dest, 1.2f);
            cmd.Sprint = distGoal > 9f && p.Stamina > 0.4f && sim.Rng.Chance(tactic.TransitionSprint);
        }

        /// <summary>0..1 estimate of how good a shot is from the current spot.</summary>
        public static float ShotQuality(MatchSimulation sim, SimPlayer p)
        {
            var cfg = sim.Config;
            Vec3 goal = cfg.TargetGoalCenter(p.TeamIndex);
            float dist = Vec3.FlatDistance(p.Position, goal);
            float range = FMath.Lerp(7f, 11f, p.EffectiveShooting) * FMath.Lerp(0.9f, 1.1f, p.EffectivePower);
            float distFactor = 1f - FMath.Clamp01((dist - 2f) / range);

            float dx = MathF.Abs(goal.X - p.Position.X);
            float angle = MathF.Atan2(MathF.Abs(p.Position.Z - goal.Z), MathF.Max(0.1f, dx));
            float angleFactor = FMath.Clamp01((angle - 0.6f) / 0.8f);

            int blockers = 0;
            foreach (var o in sim.Teams[1 - p.TeamIndex].FieldPlayers)
            {
                float d = Vec3.FlatDistanceToSegment(o.Position, p.Position, goal, out float t);
                if (t > 0.05f && t < 0.9f && d < 0.8f) blockers++;
            }

            float q = distFactor * 0.8f + (1f - angleFactor) * 0.25f
                      - sim.NearestOpponentPressure(p) * 0.25f - blockers * 0.18f;
            return FMath.Clamp01(q);
        }

        // ------------------------------------------------------------------ attack without ball

        private static void SupportLogic(MatchSimulation sim, SimPlayer p, ref PlayerCommand cmd, bool decide, TacticParams tactic)
        {
            var cfg = sim.Config;
            Vec3 spot;
            if (tactic.SafetyPlayers > 0 && p.Slot == 2)
            {
                spot = Formation.SafetySpot(cfg, p.TeamIndex);
            }
            else
            {
                spot = Formation.AttackSpot(cfg, p.TeamIndex, p.Slot, tactic);
                // "Appel": periodic drive toward goal, then back to the slot.
                float wave = MathF.Sin(sim.Time * 0.7f + p.Id * 1.7f);
                if (wave > 0.6f)
                {
                    Vec3 toGoal = (cfg.TargetGoalCenter(p.TeamIndex) - spot).Flat.Normalized;
                    spot = spot + toGoal * 1.2f;
                }

                // Get open: step away from a tight marker.
                SimPlayer marker = sim.ClosestOpponent(p, out float md);
                if (marker != null && md < 1.1f)
                {
                    Vec3 away = (p.Position - marker.Position).Flat.Normalized;
                    spot = spot + away * 1.0f;
                }

                // Positioning accuracy: weaker players drift from the ideal spot.
                float posErr = PositioningError(p);
                spot = spot + new Vec3(MathF.Sin(p.Id * 3.1f) * posErr, 0f, MathF.Cos(p.Id * 2.3f) * posErr);
            }

            float dist = Vec3.FlatDistance(p.Position, spot);
            cmd.Move = Steer(p, spot, 0.4f);
            if (decide) p.AiWantsSprint = dist > 4f && p.Stamina > 0.35f && sim.Rng.Chance(tactic.TransitionSprint);
            cmd.Sprint = p.AiWantsSprint && dist > 2f;
        }

        // ------------------------------------------------------------------ defense

        private static void DefenseLogic(MatchSimulation sim, SimPlayer p, ref PlayerCommand cmd, bool decide, TacticParams tactic)
        {
            var cfg = sim.Config;
            var ball = sim.Ball;
            Vec3 ownGoal = cfg.OwnGoalCenter(p.TeamIndex);
            var opponents = sim.Teams[1 - p.TeamIndex];
            SimPlayer mark = opponents.FieldPlayerInSlot(p.Slot) ?? sim.ClosestOpponent(p, out _);
            if (mark == null)
            {
                cmd.Move = Steer(p, ownGoal, 1f);
                return;
            }

            bool markHasBall = ball.Owner == mark;
            float markDistance = tactic.MarkDistance * (markHasBall ? 0.75f : 1f);
            Vec3 toGoal = (ownGoal - mark.Position).Flat;
            Vec3 goalSide = mark.Position + toGoal.Normalized * MathF.Min(markDistance, toGoal.Magnitude * 0.5f);
            // Denial: front the mark on the ball side so passes to him are cut.
            Vec3 toBall = (ball.Position - mark.Position).Flat;
            Vec3 ballSide = mark.Position + toBall.Normalized * MathF.Min(markDistance, toBall.Magnitude * 0.5f);
            // Only perimeter players are fronted; marks close to goal are always played goal-side.
            float denial = tactic.Denial * FMath.InverseLerp(5f, 8f, toGoal.Magnitude);
            Vec3 manPos = markHasBall ? goalSide : Vec3.Lerp(goalSide, ballSide, denial);

            // Zone: collapse toward the 2–5 m area in front of goal.
            float zoneDepth = 4f;
            Vec3 zonePos = ownGoal + (mark.Position - ownGoal).Flat.Normalized * MathF.Min(zoneDepth, toGoal.Magnitude);
            float drop = markHasBall ? tactic.ZoneDrop * 0.3f : tactic.ZoneDrop;
            Vec3 target = Vec3.Lerp(manPos, zonePos, drop);

            // Interception: step into the lane of a pass in flight that comes near.
            if (ball.State == BallState.Passed && ball.PossessionTeam != p.TeamIndex)
            {
                Vec3 ahead = ball.Position.Flat + ball.Velocity.Flat * 0.3f;
                if (Vec3.FlatDistance(p.Position, ahead) < 2.5f) target = ahead;
            }

            float dist = Vec3.FlatDistance(p.Position, target);
            cmd.Move = Steer(p, target, 0.15f);
            cmd.Sprint = dist > 3f && p.Stamina > 0.25f;

            if (decide)
            {
                float toCarrier = markHasBall ? Vec3.FlatDistance(p.Position, mark.Position) : 99f;
                if (markHasBall && mark.IsChargingShot && toCarrier < 2.5f)
                {
                    cmd.Defend = true; // raise the arm to block
                }
                else if (markHasBall && toCarrier < Duels.StealRange && p.StealCooldown <= 0f)
                {
                    float attempt = 0.22f * tactic.PressIntensity * p.Profile.Aggression;
                    if (sim.Rng.Chance(attempt)) cmd.Defend = true;
                }
            }
        }

        /// <summary>Seconds between two decisions (Intelligence, scaled by CPU difficulty).</summary>
        public static float DecisionInterval(float intelligence01) => FMath.Lerp(0.4f, 0.15f, intelligence01);

        /// <summary>Metres of drift from the ideal tactical spot (Positioning).</summary>
        public static float PositioningError(SimPlayer p) => (1f - PlayerStats.N(p.Stats.Positioning)) * 1.2f;

        /// <summary>Move vector toward a point with arrival slow-down.</summary>
        public static Vec3 Steer(SimPlayer p, Vec3 target, float arriveRadius)
        {
            Vec3 d = (target - p.Position).Flat;
            float dist = d.Magnitude;
            if (dist < 0.05f) return Vec3.Zero;
            float slow = arriveRadius > 0f ? FMath.Clamp01(dist / (arriveRadius + 0.6f)) : 1f;
            return d / dist * slow;
        }
    }
}
