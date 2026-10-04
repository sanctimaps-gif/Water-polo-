using System;
using System.Collections.Generic;
using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>
    /// Deterministic, engine-independent water polo match.
    /// Call <see cref="Step"/> at a fixed rate (Config.FixedDeltaTime). The Unity layer
    /// only feeds the human command and renders the state; it never mutates gameplay.
    /// </summary>
    public sealed class MatchSimulation
    {
        public readonly MatchConfig Config;
        public readonly SimTeam[] Teams = new SimTeam[2];
        public readonly List<SimPlayer> Players = new List<SimPlayer>();
        public readonly SimBall Ball = new SimBall();
        public readonly RuleManager Rules;
        public readonly MatchStats Stats;
        public readonly DeterministicRandom Rng;

        public float Time { get; private set; }
        public int TickCount { get; private set; }

        /// <summary>Player currently driven by the touch controls (null in AI vs AI).</summary>
        public SimPlayer HumanPlayer { get; private set; }

        private readonly List<MatchEvent> _events = new List<MatchEvent>();
        private PlayerCommand _humanCommand;
        private readonly SimPlayer[] _assistCandidate = new SimPlayer[2];

        public MatchSimulation(MatchConfig config, TeamDefinition home, TeamDefinition away)
        {
            Config = config ?? new MatchConfig();
            Rng = new DeterministicRandom(Config.Seed);
            Rules = new RuleManager(this);

            BuildTeam(0, home ?? DemoTeams.Home());
            BuildTeam(1, away ?? DemoTeams.Away());
            Stats = new MatchStats(Players.Count);

            if (Config.HumanTeam == 0 || Config.HumanTeam == 1)
            {
                var t = Teams[Config.HumanTeam];
                SetHumanPlayer(t.FieldPlayerInSlot(2) ?? t.FieldPlayers[0], false);
            }
        }

        private void BuildTeam(int index, TeamDefinition def)
        {
            if (def.Players.Count != 7) throw new ArgumentException($"Team {def.Name} must have 7 players (1 GK + 6).");
            var team = new SimTeam { Index = index, Definition = def };
            team.SetTactic(def.Tactic);
            foreach (var pd in def.Players)
            {
                var p = new SimPlayer
                {
                    Id = Players.Count,
                    TeamIndex = index,
                    Number = pd.Number,
                    Name = pd.Name,
                    Role = pd.Role,
                    Personality = pd.Personality,
                    Profile = PersonalityProfile.For(pd.Personality),
                    Stats = pd.Stats,
                    Slot = pd.Role == PlayerRole.Goalkeeper ? -1 : pd.Slot,
                };
                Players.Add(p);
                team.Players.Add(p);
                if (p.IsGoalkeeper)
                {
                    if (team.Goalkeeper != null) throw new ArgumentException($"Team {def.Name} has two goalkeepers.");
                    team.Goalkeeper = p;
                }
                else
                {
                    team.FieldPlayers.Add(p);
                }
            }
            if (team.Goalkeeper == null) throw new ArgumentException($"Team {def.Name} has no goalkeeper.");
            Teams[index] = team;
        }

        public void StartMatch() => Rules.StartMatch();

        public bool IsFinished => Rules.Phase == MatchPhase.Ended;

        // ====================================================================== input API

        /// <summary>
        /// Feeds the human command. Continuous fields (move, sprint, held) are overwritten,
        /// one-shot actions (pass, release, quick shot, defend) are accumulated until a tick consumes them.
        /// </summary>
        public void SetHumanCommand(PlayerCommand cmd)
        {
            bool pass = _humanCommand.Pass || cmd.Pass;
            bool release = _humanCommand.ShootReleased || cmd.ShootReleased;
            bool quick = _humanCommand.QuickShot || cmd.QuickShot;
            bool defend = _humanCommand.Defend || cmd.Defend;
            Vec3 passDir = cmd.Pass ? cmd.PassDirection : _humanCommand.PassDirection;
            bool lob = cmd.Pass ? cmd.LobPass : _humanCommand.LobPass;
            bool hasAim = cmd.HasAim || _humanCommand.HasAim;
            float aimX = cmd.HasAim ? cmd.AimX : _humanCommand.AimX;
            float aimY = cmd.HasAim ? cmd.AimY : _humanCommand.AimY;
            bool lobShot = cmd.LobShot || _humanCommand.LobShot;

            _humanCommand = cmd;
            _humanCommand.Pass = pass;
            _humanCommand.PassDirection = passDir;
            _humanCommand.LobPass = lob;
            _humanCommand.ShootReleased = release;
            _humanCommand.QuickShot = quick;
            _humanCommand.Defend = defend;
            _humanCommand.HasAim = hasAim;
            _humanCommand.AimX = aimX;
            _humanCommand.AimY = aimY;
            _humanCommand.LobShot = lobShot;
        }

        /// <summary>CHANGEMENT button: ball carrier if we have it, else the team-mate best placed to defend.</summary>
        public void SwitchHumanPlayer()
        {
            if (HumanPlayer == null) return;
            var team = Teams[HumanPlayer.TeamIndex];
            if (Ball.Owner != null && Ball.Owner.TeamIndex == team.Index)
            {
                SetHumanPlayer(Ball.Owner, true);
                return;
            }

            SimPlayer best = null;
            float bestScore = float.MaxValue;
            Vec3 ownGoal = Config.OwnGoalCenter(team.Index);
            foreach (var p in team.FieldPlayers)
            {
                if (p == HumanPlayer) continue;
                // Close to the ball, and between the ball and our goal.
                float d = Vec3.FlatDistance(p.Position, Ball.Position);
                float goalSide = Vec3.FlatDistance(p.Position, ownGoal) < Vec3.FlatDistance(Ball.Position, ownGoal) ? 0f : 1.5f;
                float s = d + goalSide;
                if (s < bestScore)
                {
                    bestScore = s;
                    best = p;
                }
            }
            if (best != null) SetHumanPlayer(best, true);
        }

        private void SetHumanPlayer(SimPlayer p, bool emit)
        {
            if (HumanPlayer == p) return;
            if (HumanPlayer != null)
            {
                HumanPlayer.IsHumanControlled = false;
                // Don't leave a half-charged shot on the player we leave.
                HumanPlayer.IsChargingShot = false;
                HumanPlayer.ShotCharge = 0f;
            }
            HumanPlayer = p;
            p.IsHumanControlled = true;
            _humanCommand = new PlayerCommand();
            if (emit) Emit(MatchEventType.HumanPlayerSwitched, p.TeamIndex, p.Id, -1, p.Position, 0f);
        }

        public void SetTactic(int team, TacticStyle style)
        {
            Teams[team].SetTactic(style);
            Emit(MatchEventType.TacticChanged, team, -1, -1, Vec3.Zero, (int)style);
        }

        public bool IsHuman(SimPlayer p) => p != null && p.IsHumanControlled;

        /// <summary>CPU difficulty multiplier (1 for the human team).</summary>
        public float SkillScale(int team) =>
            Config.HumanTeam >= 0 && team != Config.HumanTeam ? Config.CpuDifficulty : 1f;

        // ====================================================================== simulation step

        public void Step()
        {
            float dt = Config.FixedDeltaTime;
            Time += dt;
            TickCount++;

            if (Rules.Phase == MatchPhase.NotStarted) Rules.StartMatch();
            if (Rules.Phase == MatchPhase.Ended) return;

            Rules.Tick(dt);

            if (Rules.Phase != MatchPhase.Live)
            {
                // Dead ball: players drift and recover, no actions.
                foreach (var p in Players) SwimmerMotor.Step(p, Vec3.Zero, false, Ball.Owner == p, dt);
                ResolvePlayerSpacing();
                if (Ball.Owner != null) Ball.SnapToOwner();
                ConsumeHumanOneShots();
                return;
            }

            // 1. Decisions.
            foreach (var p in Players)
            {
                if (p.IsHumanControlled) p.Command = _humanCommand;
                else if (p.IsGoalkeeper) GoalkeeperAI.Think(this, p, dt);
                else FieldPlayerAI.Think(this, p, dt);
            }
            ConsumeHumanOneShots();

            // 2. Actions + locomotion.
            foreach (var p in Players)
            {
                ApplyCommand(p, dt);
                if (Rules.Phase != MatchPhase.Live) return; // a foul stopped play
            }
            ResolvePlayerSpacing();

            // 3. Ball.
            if (Ball.Owner != null)
            {
                Ball.SnapToOwner();
                Ball.Owner.PossessionTime += dt;
            }
            else
            {
                Vec3 prev = Ball.Position;
                BallPhysics.Integrate(Ball, dt);
                ResolveGoalkeeper();
                if (Ball.Owner == null) ResolveBoundaries(prev);
                if (Rules.Phase == MatchPhase.Live && Ball.Owner == null) ResolveBallContacts();
                if (Ball.Owner == null) SettleBall();
            }

            if (Ball.PossessionTeam >= 0) Stats.Teams[Ball.PossessionTeam].PossessionTime += dt;
        }

        private void ConsumeHumanOneShots()
        {
            _humanCommand.Pass = false;
            _humanCommand.ShootReleased = false;
            _humanCommand.QuickShot = false;
            _humanCommand.Defend = false;
            _humanCommand.HasAim = false;
            _humanCommand.LobShot = false;
        }

        // ---------------------------------------------------------------------- commands

        private void ApplyCommand(SimPlayer p, float dt)
        {
            var cmd = p.Command;
            bool hasBall = Ball.Owner == p;

            if (p.ActionCooldown > 0f) p.ActionCooldown -= dt;
            if (p.StealCooldown > 0f) p.StealCooldown -= dt;
            if (p.StunTimer > 0f) p.StunTimer -= dt;
            if (p.BlockTimer > 0f) p.BlockTimer -= dt;

            if (hasBall && p.StunTimer <= 0f)
            {
                // A tap shorter than one tick (release without any charge) is a quick shot.
                bool tapShot = cmd.ShootReleased && !cmd.ShootHeld && !p.IsChargingShot;
                if ((cmd.QuickShot || tapShot) && p.ActionCooldown <= 0f)
                {
                    TakeShot(p, ShotSystem.QuickShotCharge, TimingQuality.None, cmd);
                    hasBall = false;
                }
                else if (cmd.ShootHeld && p.ActionCooldown <= 0f)
                {
                    p.IsChargingShot = true;
                    p.ShotCharge = MathF.Min(1f, p.ShotCharge + dt / ShotTiming.ChargeTime);
                    if (p.ShotCharge >= 1f) p.ShotChargeHeldAtMax += dt;
                }
                else if (p.IsChargingShot)
                {
                    // Button released (or AI reached its target charge): shoot.
                    TimingQuality q = Config.ShotTimingEnabled && IsHuman(p)
                        ? ShotTiming.Evaluate(p.ShotCharge, p.ShotChargeHeldAtMax)
                        : TimingQuality.None;
                    TakeShot(p, MathF.Max(0.2f, p.ShotCharge), q, cmd);
                    hasBall = false;
                }
                else if (cmd.Pass && p.ActionCooldown <= 0f)
                {
                    DoPass(p, cmd);
                    hasBall = false;
                }
            }
            else if (!hasBall)
            {
                p.IsChargingShot = false;
                p.ShotCharge = 0f;
                p.ShotChargeHeldAtMax = 0f;
                if (cmd.Defend && p.StunTimer <= 0f) DoDefend(p);
            }

            // Charging a shot means rising out of the water: little movement.
            Vec3 move = p.IsChargingShot ? cmd.Move * 0.35f : cmd.Move;
            SwimmerMotor.Step(p, move, cmd.Sprint && !p.IsChargingShot, hasBall, dt);
            if (p.IsChargingShot) SwimmerMotor.FaceTowards(p, Config.TargetGoalCenter(p.TeamIndex), dt);

            ClampToField(p);
            Stats.Players[p.Id].DistanceSwum += p.Velocity.Magnitude * dt;
        }

        private void TakeShot(SimPlayer p, float charge, TimingQuality q, PlayerCommand cmd)
        {
            p.IsChargingShot = false;
            p.ShotCharge = 0f;
            p.ShotChargeHeldAtMax = 0f;
            p.AiShotTargetCharge = -1f;
            ShotSystem.Execute(this, p, charge, q, cmd);
        }

        private void DoPass(SimPlayer p, PlayerCommand cmd)
        {
            AssistLevel assist = IsHuman(p) ? Config.Assist : AssistLevel.Standard;
            Vec3 dir = cmd.PassDirection.SqrMagnitude > 0.01f ? cmd.PassDirection : (IsHuman(p) ? cmd.Move : Vec3.Zero);
            var tactic = Teams[p.TeamIndex].TacticParams;
            SimPlayer target = PassSystem.ChooseTarget(this, p, dir, assist, p.Profile.PassRisk, tactic.CenterFeedBonus);
            PassSystem.Execute(this, p, target, dir, cmd.LobPass);
        }

        private void DoDefend(SimPlayer p)
        {
            SimPlayer carrier = Ball.Owner;
            if (carrier != null && carrier.TeamIndex != p.TeamIndex && p.StealCooldown <= 0f &&
                Vec3.FlatDistance(p.Position, carrier.Position) < Duels.StealRange)
            {
                // Pressing teams (AI) re-engage faster; the human's rhythm never depends on the tactic.
                float press = IsHuman(p) ? 1f : Teams[p.TeamIndex].TacticParams.PressIntensity;
                p.StealCooldown = 1.2f / MathF.Max(0.5f, press);
                if (Rng.Chance(Duels.StealChance(p, carrier, SkillScale(p.TeamIndex))))
                {
                    Stats.Teams[p.TeamIndex].Steals++;
                    Stats.Players[p.Id].Steals++;
                    Emit(MatchEventType.Steal, p.TeamIndex, p.Id, carrier.Id, carrier.Position, 0f);
                    GivePossession(p, true);
                    return;
                }

                if (Rng.Chance(Duels.FoulChance(p, carrier)))
                {
                    Stats.Teams[p.TeamIndex].Fouls++;
                    Stats.Players[p.Id].Fouls++;
                    // Ordinary foul: the defender must release and gives a little space.
                    p.StunTimer = 0.6f;
                    Vec3 back = (Config.OwnGoalCenter(p.TeamIndex) - p.Position).Flat.Normalized;
                    p.Position = p.Position + back * 0.5f;
                    Emit(MatchEventType.Foul, p.TeamIndex, p.Id, carrier.Id, carrier.Position, 0f);
                    Rules.OnFoul(carrier);
                }
                return;
            }

            // Not next to the carrier: raise the arm to block shots/passes.
            if (p.BlockTimer <= 0f && p.StealCooldown <= 0f)
            {
                p.BlockTimer = 0.6f;
                p.StealCooldown = 0.9f;
            }
        }

        // ---------------------------------------------------------------------- ball resolution

        private void ResolveGoalkeeper()
        {
            if (Ball.State != BallState.Shot || Ball.SaveResolved || Ball.Shooter == null) return;
            var gk = Teams[1 - Ball.Shooter.TeamIndex].Goalkeeper;
            float sign = Config.AttackSign(Ball.Shooter.TeamIndex);
            // Trigger when the ball reaches the goalkeeper's plane (or the goal line if he is behind it).
            float planeX = gk.Position.X;
            float goalX = Config.TargetGoalCenter(Ball.Shooter.TeamIndex).X;
            if ((planeX - goalX) * sign > 0f) planeX = goalX;
            if ((Ball.Position.X - planeX) * sign < -0.05f) return;
            if (Vec3.FlatDistance(Ball.Position, gk.Position) > 3.5f && (Ball.Position.X - goalX) * sign < -0.3f) return;

            Ball.SaveResolved = true;
            var outcome = GoalkeeperAI.ResolveSave(this, gk, Ball);
            if (outcome == GoalkeeperAI.SaveOutcome.Caught || outcome == GoalkeeperAI.SaveOutcome.Parried)
            {
                var shooter = Ball.Shooter;
                Stats.Teams[gk.TeamIndex].Saves++;
                Stats.Players[gk.Id].Saves++;
                Stats.Teams[shooter.TeamIndex].ShotsOnTarget++;
                Emit(MatchEventType.ShotSaved, gk.TeamIndex, gk.Id, shooter.Id, Ball.Position, outcome == GoalkeeperAI.SaveOutcome.Caught ? 1f : 0f);
                Ball.LastTouch = gk;
                if (outcome == GoalkeeperAI.SaveOutcome.Caught)
                {
                    GivePossession(gk, true);
                }
                else
                {
                    Vec3 v = Ball.Velocity;
                    Vec3 parry = new Vec3(-v.X * 0.25f, 1.5f + Rng.NextFloat(), Rng.Range(-3f, 3f));
                    Ball.Velocity = parry;
                    Ball.Position = new Vec3(Ball.Position.X - sign * 0.25f, Ball.Position.Y, Ball.Position.Z);
                    Ball.SetState(BallState.Deflected);
                }
            }
        }

        private void ResolveBoundaries(Vec3 prev)
        {
            BoundaryResult r = BallPhysics.CheckBoundaries(Ball, prev, Config, out int side);
            switch (r)
            {
                case BoundaryResult.Goal:
                {
                    int scoringTeam = 1 - side;
                    SimPlayer scorer = Ball.Shooter != null && Ball.Shooter.TeamIndex == scoringTeam ? Ball.Shooter
                        : (Ball.LastTouch != null && Ball.LastTouch.TeamIndex == scoringTeam ? Ball.LastTouch : null);
                    SimPlayer assist = scorer != null ? _assistCandidate[scoringTeam] : null;
                    if (assist == scorer) assist = null;

                    Stats.Teams[scoringTeam].Goals++;
                    if (Ball.State == BallState.Shot) Stats.Teams[scoringTeam].ShotsOnTarget++;
                    if (scorer != null) Stats.Players[scorer.Id].Goals++;
                    if (assist != null) Stats.Players[assist.Id].Assists++;

                    Ball.SetState(BallState.Goal);
                    Rules.OnGoal(scoringTeam);
                    Emit(MatchEventType.Goal, scoringTeam, scorer != null ? scorer.Id : -1, assist != null ? assist.Id : -1, Ball.Position, Teams[scoringTeam].Score);
                    break;
                }
                case BoundaryResult.Frame:
                    Emit(MatchEventType.ShotHitFrame, Ball.Shooter != null ? Ball.Shooter.TeamIndex : -1,
                        Ball.Shooter != null ? Ball.Shooter.Id : -1, -1, Ball.Position, 0f);
                    Ball.SetState(BallState.Deflected);
                    break;
                case BoundaryResult.OutGoalLine:
                case BoundaryResult.OutSide:
                    if (Ball.State == BallState.Shot && Ball.Shooter != null)
                        Emit(MatchEventType.ShotOffFrame, Ball.Shooter.TeamIndex, Ball.Shooter.Id, -1, Ball.Position, 0f);
                    Emit(MatchEventType.BallOut, Ball.LastTouch != null ? Ball.LastTouch.TeamIndex : -1, -1, -1, Ball.Position, 0f);
                    Rules.OnBallOut(r, side, Ball.Position);
                    break;
            }
        }

        private void ResolveBallContacts()
        {
            switch (Ball.State)
            {
                case BallState.Passed:
                    ResolvePassFlight();
                    break;
                case BallState.Shot:
                    ResolveShotBlocks();
                    break;
                case BallState.Free:
                case BallState.Deflected:
                case BallState.Blocked:
                    ResolveLooseBall();
                    break;
            }
        }

        private void ResolvePassFlight()
        {
            if (Ball.StateTime < 0.08f || Ball.Position.Y > 2.2f) return;
            float speed = Ball.Velocity.Magnitude;

            // Opponents first: interception attempt, once per player per pass.
            foreach (var o in Players)
            {
                if (o.TeamIndex == Ball.PossessionTeam || o.StunTimer > 0f) continue;
                ulong bit = 1UL << o.Id;
                if ((Ball.InterceptTried & bit) != 0) continue;
                if (Vec3.FlatDistance(o.Position, Ball.Position) > Duels.InterceptRadius(o) || Ball.Position.Y > 1.5f) continue;
                Ball.InterceptTried |= bit;
                if (Rng.Chance(Duels.InterceptChance(o, speed, SkillScale(o.TeamIndex))))
                {
                    Stats.Teams[o.TeamIndex].Interceptions++;
                    Stats.Players[o.Id].Interceptions++;
                    Emit(MatchEventType.PassIntercepted, o.TeamIndex, o.Id, Ball.Passer != null ? Ball.Passer.Id : -1, Ball.Position, 0f);
                    GivePossession(o, true);
                    return;
                }
            }

            // Team-mates (intended receiver first).
            if (TryCatch(Ball.IntendedReceiver, speed)) return;
            foreach (var m in Teams[Ball.PossessionTeam].Players)
                if (m != Ball.IntendedReceiver && m != Ball.Passer && TryCatch(m, speed)) return;
        }

        private bool TryCatch(SimPlayer m, float speed)
        {
            if (m == null || m.StunTimer > 0f || Ball.Position.Y > 1.8f) return false;
            bool assisted = IsHuman(m) && Config.Assist == AssistLevel.Assisted;
            if (Vec3.FlatDistance(m.Position, Ball.Position) > Duels.CatchRadius(m, assisted)) return false;

            if (Rng.Chance(Duels.FumbleChance(m, speed)))
            {
                Ball.LastTouch = m;
                Ball.Velocity = new Vec3(Ball.Velocity.X * 0.2f, 0.5f, Ball.Velocity.Z * 0.2f);
                Ball.SetState(BallState.Free);
                return true;
            }

            var passer = Ball.Passer;
            if (passer != null && passer.TeamIndex == m.TeamIndex)
            {
                Stats.Teams[m.TeamIndex].PassesCompleted++;
                Stats.Players[passer.Id].PassesCompleted++;
                if (m.Slot == 5) Stats.Teams[m.TeamIndex].CenterFeeds++;
                _assistCandidate[m.TeamIndex] = passer;
                Emit(MatchEventType.PassCompleted, m.TeamIndex, passer.Id, m.Id, Ball.Position, 0f);
            }
            GivePossession(m, true);
            return true;
        }

        private void ResolveShotBlocks()
        {
            if (Ball.StateTime < 0.05f || Ball.Position.Y > 1.5f) return;
            foreach (var d in Teams[1 - Ball.Shooter.TeamIndex].FieldPlayers)
            {
                ulong bit = 1UL << d.Id;
                if ((Ball.InterceptTried & bit) != 0 || d.StunTimer > 0f) continue;
                if (Vec3.FlatDistance(d.Position, Ball.Position) > Duels.BlockRadius(d)) continue;
                Ball.InterceptTried |= bit;
                if (!Rng.Chance(Duels.BlockChance(d, SkillScale(d.TeamIndex)))) continue;

                Stats.Teams[d.TeamIndex].Blocks++;
                Emit(MatchEventType.ShotBlocked, d.TeamIndex, d.Id, Ball.Shooter.Id, Ball.Position, 0f);
                Vec3 v = Ball.Velocity;
                Ball.LastTouch = d;
                Ball.Velocity = new Vec3(-v.X * 0.2f + Rng.Range(-1f, 1f), 1.2f, v.Z * 0.2f + Rng.Range(-2f, 2f));
                Ball.SetState(BallState.Blocked);
                return;
            }
        }

        private void ResolveLooseBall()
        {
            if (Ball.Position.Y > 0.9f || Ball.Velocity.Flat.Magnitude > 7f) return;
            SimPlayer best = null;
            float bestDist = float.MaxValue;
            foreach (var p in Players)
            {
                if (p.StunTimer > 0f) continue;
                float d = Vec3.FlatDistance(p.Position, Ball.Position);
                if (d <= Duels.PickupRadius(p) && d < bestDist)
                {
                    best = p;
                    bestDist = d;
                }
            }

            if (best == null) return;
            bool rebound = Ball.Shooter != null && best.TeamIndex == Ball.Shooter.TeamIndex &&
                           (Ball.State == BallState.Deflected || Ball.State == BallState.Blocked);
            GivePossession(best, true);
            if (rebound) Rules.OnOffensiveRebound();
        }

        /// <summary>A ball in flight that has died on the water becomes a free ball.</summary>
        private void SettleBall()
        {
            if (Ball.State == BallState.Goal || Ball.State == BallState.Out || Ball.State == BallState.Free) return;
            if (BallPhysics.IsOnWater(Ball) && Ball.Velocity.Flat.Magnitude < 1.5f && Ball.StateTime > 0.2f)
            {
                if (Ball.State == BallState.Shot && Ball.Shooter != null)
                    Emit(MatchEventType.ShotOffFrame, Ball.Shooter.TeamIndex, Ball.Shooter.Id, -1, Ball.Position, 0f);
                Ball.SetState(BallState.Free);
            }
        }

        /// <summary>Gives the ball to a player (catch, pick-up, steal, interception, restart).</summary>
        public void GivePossession(SimPlayer p, bool fromPlay)
        {
            int previousTeam = Ball.PossessionTeam;
            Ball.Shooter = null;
            Ball.GiveTo(p);
            p.PossessionTime = 0f;
            p.IsChargingShot = false;
            p.ShotCharge = 0f;
            p.AiShotTargetCharge = -1f;
            p.NextDecisionTime = Time + p.ReactionTime;

            if (previousTeam != p.TeamIndex)
            {
                _assistCandidate[0] = null;
                _assistCandidate[1] = null;
                Rules.OnPossessionChanged(p.TeamIndex);
                if (fromPlay) Emit(MatchEventType.PossessionWon, p.TeamIndex, p.Id, -1, p.Position, 0f);
            }

            // Human team: control follows the ball.
            if (HumanPlayer != null && p.TeamIndex == HumanPlayer.TeamIndex && p != HumanPlayer && !p.IsGoalkeeper)
                SetHumanPlayer(p, true);
        }

        // ---------------------------------------------------------------------- callbacks from systems

        internal void OnPassMade(SimPlayer passer, SimPlayer target)
        {
            Stats.Teams[passer.TeamIndex].Passes++;
            Stats.Players[passer.Id].Passes++;
            Emit(MatchEventType.PassMade, passer.TeamIndex, passer.Id, target != null ? target.Id : -1, passer.Position, 0f);
        }

        internal void OnShotTaken(SimPlayer shooter, TimingQuality timing, float charge)
        {
            Stats.Teams[shooter.TeamIndex].Shots++;
            Stats.Players[shooter.Id].Shots++;
            Emit(MatchEventType.ShotTaken, shooter.TeamIndex, shooter.Id, (int)timing, shooter.Position, Ball.Velocity.Magnitude);
        }

        public void Emit(MatchEventType type, int team, int playerId, int otherId, Vec3 pos, float value)
        {
            _events.Add(new MatchEvent { Type = type, Time = Time, Team = team, PlayerId = playerId, OtherPlayerId = otherId, Position = pos, Value = value });
        }

        /// <summary>Moves pending events into <paramref name="into"/> and clears the queue.</summary>
        public void DrainEvents(List<MatchEvent> into)
        {
            into.AddRange(_events);
            _events.Clear();
        }

        // ---------------------------------------------------------------------- spatial queries (used by AI/systems)

        public int TeamInPossession => Ball.Owner != null ? Ball.Owner.TeamIndex : Ball.PossessionTeam;

        /// <summary>0 when no opponent within 1.6 m, up to 1 when an opponent is on top of the player.</summary>
        public float NearestOpponentPressure(SimPlayer p)
        {
            ClosestOpponent(p, out float d);
            return d < 1.6f ? (1.6f - d) / 1.6f : 0f;
        }

        public SimPlayer ClosestOpponent(SimPlayer p, out float distance)
        {
            SimPlayer best = null;
            distance = float.MaxValue;
            foreach (var o in Teams[1 - p.TeamIndex].Players)
            {
                float d = Vec3.FlatDistance(o.Position, p.Position);
                if (d < distance)
                {
                    distance = d;
                    best = o;
                }
            }
            return best;
        }

        public SimPlayer ClosestPlayer(int team, Vec3 point, bool includeGoalkeeper)
        {
            SimPlayer best = null;
            float bestD = float.MaxValue;
            foreach (var p in Teams[team].Players)
            {
                if (p.IsGoalkeeper && !includeGoalkeeper) continue;
                float d = Vec3.FlatDistance(p.Position, point);
                if (d < bestD)
                {
                    bestD = d;
                    best = p;
                }
            }
            return best;
        }

        /// <summary>True if p is among the n players (of its team, or of both teams) closest to the ball.</summary>
        public bool IsAmongClosestToBall(SimPlayer p, int n, bool anyTeam = false)
        {
            float mine = Vec3.FlatDistance(p.Position, Ball.Position);
            int closer = 0;
            foreach (var o in Players)
            {
                if (o == p || (!anyTeam && o.TeamIndex != p.TeamIndex)) continue;
                if (!anyTeam && o.IsGoalkeeper) continue;
                float d = Vec3.FlatDistance(o.Position, Ball.Position);
                if (d < mine || (d == mine && o.Id < p.Id)) closer++;
                if (closer >= n) return false;
            }
            return true;
        }

        public bool LaneBlocked(SimPlayer from, SimPlayer to)
        {
            foreach (var o in Teams[1 - from.TeamIndex].Players)
            {
                float d = Vec3.FlatDistanceToSegment(o.Position, from.Position, to.Position, out float t);
                if (t > 0.1f && t < 0.9f && d < 1f) return true;
            }
            return false;
        }

        private void ClampToField(SimPlayer p)
        {
            float hl = Config.HalfLength - 0.3f;
            float hw = Config.HalfWidth - 0.3f;
            Vec3 pos = p.Position;
            pos.X = FMath.Clamp(pos.X, -hl, hl);
            pos.Z = FMath.Clamp(pos.Z, -hw, hw);
            if (p.IsGoalkeeper)
            {
                // Goalkeepers stay in their own half.
                if (p.TeamIndex == 0) pos.X = MathF.Min(pos.X, 0f);
                else pos.X = MathF.Max(pos.X, 0f);
            }
            p.Position = pos;
        }

        /// <summary>Simple body separation so swimmers do not overlap.</summary>
        private void ResolvePlayerSpacing()
        {
            const float minDist = 0.75f;
            for (int i = 0; i < Players.Count; i++)
            {
                for (int j = i + 1; j < Players.Count; j++)
                {
                    var a = Players[i];
                    var b = Players[j];
                    Vec3 d = (b.Position - a.Position).Flat;
                    float dist = d.Magnitude;
                    if (dist >= minDist) continue;
                    Vec3 n = dist > 1e-4f ? d / dist : new Vec3(1f, 0f, 0f);
                    // The stronger (Physical) swimmer is pushed less.
                    float pa = PlayerStats.N(a.Stats.Physical), pb = PlayerStats.N(b.Stats.Physical);
                    float wa = 0.5f + (pb - pa) * 0.3f;
                    float push = minDist - dist;
                    a.Position = a.Position - n * (push * wa);
                    b.Position = b.Position + n * (push * (1f - wa));
                }
            }
            foreach (var p in Players) ClampToField(p);
            if (Ball.Owner != null) Ball.SnapToOwner();
        }
    }
}
