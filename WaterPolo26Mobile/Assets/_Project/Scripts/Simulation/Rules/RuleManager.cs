using System;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    public enum MatchPhase
    {
        NotStarted,
        /// <summary>Ball in play (includes the swim-off sprint at the start of each period).</summary>
        Live,
        GoalPause,
        /// <summary>Short stop before a restart (ball out, shot-clock violation, foul).</summary>
        DeadBall,
        PeriodBreak,
        Ended,
    }

    /// <summary>
    /// Owns the match rules: periods and running clock, shot clock, swim-off,
    /// goals and restarts, ball out of play, fouls (free throw).
    /// NOT IMPLEMENTED yet (Phase 2+): exclusions (20 s), penalties (5 m),
    /// 2 m offside, time-outs, penalty shoot-out. Draws are allowed.
    /// </summary>
    public sealed class RuleManager
    {
        private readonly MatchSimulation _sim;
        private MatchConfig Cfg => _sim.Config;

        public MatchPhase Phase { get; private set; } = MatchPhase.NotStarted;
        public int Period { get; private set; }
        public float PeriodTimeRemaining { get; private set; }
        public float ShotClockRemaining { get; private set; }
        public float PhaseTimer { get; private set; }

        private int _restartTeam = -1;
        private Vec3 _restartPosition;
        private bool _restartIsGoalThrow;
        private bool _restartAfterGoal;
        private SimPlayer _restartTaker;

        public RuleManager(MatchSimulation sim)
        {
            _sim = sim;
        }

        public bool IsLive => Phase == MatchPhase.Live;

        public void StartMatch()
        {
            Period = 1;
            BeginPeriod();
        }

        public void Tick(float dt)
        {
            switch (Phase)
            {
                case MatchPhase.Live:
                    PeriodTimeRemaining -= dt;
                    if (_sim.Ball.PossessionTeam >= 0)
                    {
                        ShotClockRemaining -= dt;
                        if (ShotClockRemaining <= 0f)
                        {
                            ShotClockViolation();
                            break;
                        }
                    }
                    if (PeriodTimeRemaining <= 0f)
                    {
                        PeriodTimeRemaining = 0f;
                        EndPeriod();
                    }
                    break;

                case MatchPhase.GoalPause:
                case MatchPhase.DeadBall:
                    PhaseTimer -= dt;
                    if (PhaseTimer <= 0f) ExecuteRestart();
                    break;

                case MatchPhase.PeriodBreak:
                    PhaseTimer -= dt;
                    if (PhaseTimer <= 0f)
                    {
                        Period++;
                        BeginPeriod();
                    }
                    break;
            }
        }

        // ------------------------------------------------------------------ periods

        private void BeginPeriod()
        {
            PeriodTimeRemaining = Cfg.PeriodDuration;
            ShotClockRemaining = Cfg.ShotClock;

            foreach (var team in _sim.Teams)
            foreach (var p in team.Players)
            {
                p.Position = Formation.SwimOffSpot(Cfg, team.Index, p.Slot);
                p.Velocity = Vec3.Zero;
                p.Facing = new Vec3(Cfg.AttackSign(team.Index), 0f, 0f);
                ResetActionState(p);
            }

            var ball = _sim.Ball;
            ball.Owner = null;
            ball.LastTouch = null;
            ball.PossessionTeam = -1;
            ball.Position = new Vec3(0f, SimBall.Radius, 0f);
            ball.Velocity = Vec3.Zero;
            ball.SetState(BallState.Free);

            Phase = MatchPhase.Live;
            _sim.Emit(MatchEventType.PeriodStart, -1, -1, -1, Vec3.Zero, Period);
            _sim.Emit(MatchEventType.SwimOff, -1, -1, -1, Vec3.Zero, Period);
        }

        private void EndPeriod()
        {
            _sim.Emit(MatchEventType.PeriodEnd, -1, -1, -1, _sim.Ball.Position, Period);
            if (Period >= Cfg.Periods)
            {
                Phase = MatchPhase.Ended;
                int winner = _sim.Teams[0].Score == _sim.Teams[1].Score ? -1 : (_sim.Teams[0].Score > _sim.Teams[1].Score ? 0 : 1);
                _sim.Emit(MatchEventType.MatchEnd, winner, -1, -1, Vec3.Zero, 0f);
                return;
            }

            Phase = MatchPhase.PeriodBreak;
            PhaseTimer = Cfg.PeriodBreakDuration;
        }

        // ------------------------------------------------------------------ events from the simulation

        public void OnPossessionChanged(int newTeam)
        {
            ShotClockRemaining = Cfg.ShotClock;
        }

        /// <summary>Attack kept the ball after the shot hit the frame / goalkeeper.</summary>
        public void OnOffensiveRebound()
        {
            ShotClockRemaining = Math.Max(ShotClockRemaining, Cfg.ShotClockRebound);
        }

        public void OnGoal(int scoringTeam)
        {
            _sim.Teams[scoringTeam].Score++;
            Phase = MatchPhase.GoalPause;
            PhaseTimer = Cfg.GoalPauseDuration;
            _restartTeam = 1 - scoringTeam; // the conceding team restarts from the centre
            _restartPosition = Vec3.Zero;
            _restartAfterGoal = true;
            _restartIsGoalThrow = false;
            _restartTaker = null;
        }

        public void OnBallOut(BoundaryResult result, int goalSide, Vec3 position)
        {
            var ball = _sim.Ball;
            int lastTeam = ball.LastTouch != null ? ball.LastTouch.TeamIndex : (ball.PossessionTeam >= 0 ? ball.PossessionTeam : 0);
            _restartAfterGoal = false;
            _restartTaker = null;

            if (result == BoundaryResult.OutGoalLine)
            {
                int defending = goalSide; // side 1 (+X) is defended by team 1
                float lineX = defending == 1 ? Cfg.HalfLength : -Cfg.HalfLength;
                float inward = defending == 1 ? -1f : 1f;
                if (lastTeam == defending)
                {
                    // Corner throw for the attackers at the 2 m mark.
                    _restartTeam = 1 - defending;
                    _restartIsGoalThrow = false;
                    float side = position.Z >= 0f ? 1f : -1f;
                    _restartPosition = new Vec3(lineX + inward * 2f, 0f, side * (Cfg.HalfWidth - 0.8f));
                }
                else
                {
                    // Goal throw for the defending goalkeeper.
                    _restartTeam = defending;
                    _restartIsGoalThrow = true;
                    _restartPosition = new Vec3(lineX + inward * 1f, 0f, 0f);
                }
            }
            else
            {
                _restartTeam = 1 - lastTeam;
                _restartIsGoalThrow = false;
                float side = position.Z >= 0f ? 1f : -1f;
                _restartPosition = new Vec3(
                    FMath.Clamp(position.X, -Cfg.HalfLength + 2f, Cfg.HalfLength - 2f), 0f, side * (Cfg.HalfWidth - 0.8f));
            }

            EnterDeadBall();
        }

        /// <summary>Ordinary foul: free throw for the fouled player's team at the spot.</summary>
        public void OnFoul(SimPlayer fouled)
        {
            _restartTeam = fouled.TeamIndex;
            _restartTaker = fouled;
            _restartPosition = fouled.Position;
            _restartIsGoalThrow = false;
            _restartAfterGoal = false;
            Phase = MatchPhase.DeadBall;
            PhaseTimer = 0.5f;
        }

        private void ShotClockViolation()
        {
            var ball = _sim.Ball;
            int offending = ball.PossessionTeam;
            _sim.Emit(MatchEventType.ShotClockViolation, offending, -1, -1, ball.Position, 0f);
            _restartTeam = 1 - offending;
            _restartPosition = ball.Position.Flat;
            _restartIsGoalThrow = false;
            _restartAfterGoal = false;
            _restartTaker = null;
            EnterDeadBall();
        }

        private void EnterDeadBall()
        {
            var ball = _sim.Ball;
            if (ball.Owner != null) ball.Release(BallState.Out, Vec3.Zero);
            else ball.SetState(BallState.Out);
            ball.Velocity = Vec3.Zero;
            Phase = MatchPhase.DeadBall;
            PhaseTimer = Cfg.DeadBallPauseDuration;
        }

        private void ExecuteRestart()
        {
            var team = _sim.Teams[_restartTeam];
            SimPlayer taker;

            if (_restartAfterGoal)
            {
                foreach (var t in _sim.Teams)
                foreach (var p in t.Players)
                {
                    p.Position = Formation.RestartSpot(Cfg, t.Index, p.Slot);
                    p.Velocity = Vec3.Zero;
                    p.Facing = new Vec3(Cfg.AttackSign(t.Index), 0f, 0f);
                    ResetActionState(p);
                }
                taker = team.FieldPlayerInSlot(2) ?? team.FieldPlayers[0];
                taker.Position = new Vec3(-Cfg.AttackSign(team.Index) * 0.5f, 0f, 0f);
            }
            else if (_restartTaker != null)
            {
                taker = _restartTaker;
            }
            else if (_restartIsGoalThrow)
            {
                taker = team.Goalkeeper;
                taker.Position = _restartPosition;
            }
            else
            {
                taker = _sim.ClosestPlayer(team.Index, _restartPosition, includeGoalkeeper: false);
                taker.Position = _restartPosition;
            }

            taker.Velocity = Vec3.Zero;
            taker.ActionCooldown = 0.3f;
            foreach (var p in team.Players) p.PossessionTime = 0f;

            _sim.GivePossession(taker, false);
            ShotClockRemaining = Cfg.ShotClock;
            Phase = MatchPhase.Live;
            _restartTaker = null;
            _sim.Emit(MatchEventType.Restart, team.Index, taker.Id, -1, taker.Position, 0f);
        }

        private static void ResetActionState(SimPlayer p)
        {
            p.ShotCharge = 0f;
            p.IsChargingShot = false;
            p.ShotChargeHeldAtMax = 0f;
            p.ActionCooldown = 0f;
            p.StunTimer = 0f;
            p.BlockTimer = 0f;
            p.PossessionTime = 0f;
            p.AiShotTargetCharge = -1f;
            p.IsSprinting = false;
        }
    }
}
