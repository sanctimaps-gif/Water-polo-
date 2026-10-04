using NUnit.Framework;
using WaterPolo.Core;
using WaterPolo.Simulation;

namespace WaterPolo.Tests
{
    public class PassTests
    {
        private static MatchSimulation SetupPassScene(out SimPlayer passer, out SimPlayer markedMate, out SimPlayer openMate)
        {
            var sim = TestUtil.NewSim();
            TestUtil.ParkEveryone(sim);
            var t0 = sim.Teams[0];
            passer = t0.FieldPlayerInSlot(2);
            markedMate = t0.FieldPlayerInSlot(1);
            openMate = t0.FieldPlayerInSlot(3);
            passer.Position = new Vec3(0f, 0f, 0f);
            markedMate.Position = new Vec3(5f, 0f, -3f);
            openMate.Position = new Vec3(5f, 0f, 3f);
            sim.Teams[1].FieldPlayerInSlot(1).Position = new Vec3(4.8f, 0f, -3.3f);
            sim.Ball.GiveTo(passer);
            return sim;
        }

        [Test]
        public void AutoPass_PrefersTheOpenTeammate()
        {
            var sim = SetupPassScene(out var passer, out _, out var open);
            var target = PassSystem.ChooseTarget(sim, passer, Vec3.Zero, AssistLevel.Assisted, 1f, 0f);
            Assert.AreEqual(open, target);
        }

        [Test]
        public void ProPass_FollowsTheDirection_EvenToAMarkedMate()
        {
            var sim = SetupPassScene(out var passer, out var marked, out _);
            Vec3 dir = (marked.Position - passer.Position).Normalized;
            Assert.AreEqual(marked, PassSystem.ChooseTarget(sim, passer, dir, AssistLevel.Pro, 1f, 0f));
        }

        [Test]
        public void ProPass_WithNobodyInTheCone_HasNoTarget()
        {
            var sim = SetupPassScene(out var passer, out _, out _);
            Assert.IsNull(PassSystem.ChooseTarget(sim, passer, new Vec3(0f, 0f, 1f), AssistLevel.Pro, 1f, 0f));
        }

        [Test]
        public void AssistedPass_StillPicksTheBestOption_WhenDirectionIsVague()
        {
            var sim = SetupPassScene(out var passer, out _, out var open);
            Vec3 roughlyForward = new Vec3(1f, 0f, -0.2f).Normalized;
            Assert.AreEqual(open, PassSystem.ChooseTarget(sim, passer, roughlyForward, AssistLevel.Assisted, 1f, 0f));
        }

        [Test]
        public void HumanPass_ReachesTheReceiver()
        {
            var sim = TestUtil.NewSim(seed: 3, humanTeam: 0);
            TestUtil.ParkEveryone(sim);
            var passer = sim.HumanPlayer;
            var receiver = sim.Teams[0].FieldPlayerInSlot(3);
            passer.Position = new Vec3(0f, 0f, 0f);
            receiver.Position = new Vec3(6f, 0f, 2f);
            sim.GivePossession(passer, false);

            sim.SetHumanCommand(new PlayerCommand { Pass = true, PassDirection = (receiver.Position - passer.Position).Normalized });
            var events = TestUtil.RunSeconds(sim, 1.5f);

            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.PassMade));
            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.PassCompleted));
            Assert.AreEqual(receiver, sim.Ball.Owner);
            Assert.AreEqual(receiver, sim.HumanPlayer, "control follows the ball");
        }

        [Test]
        public void Interception_DependsOnReaction_AndBallSpeed()
        {
            var slow = TestUtil.MakePlayer(70);
            slow.Stats.Reaction = 20;
            var quick = TestUtil.MakePlayer(70);
            quick.Stats.Reaction = 95;
            Assert.Greater(Duels.InterceptChance(quick, 10f, 1f), Duels.InterceptChance(slow, 10f, 1f));
            Assert.Greater(Duels.InterceptRadius(quick), Duels.InterceptRadius(slow));
            Assert.Greater(Duels.InterceptChance(quick, 8f, 1f), Duels.InterceptChance(quick, 14f, 1f));
        }

        [Test]
        public void DefenderInThePassingLane_InterceptsSometimes()
        {
            int intercepted = 0, trials = 40;
            for (int seed = 1; seed <= trials; seed++)
            {
                var sim = TestUtil.NewSim(seed: seed, humanTeam: 0);
                TestUtil.ParkEveryone(sim);
                var passer = sim.HumanPlayer;
                var receiver = sim.Teams[0].FieldPlayerInSlot(3);
                var defender = sim.Teams[1].FieldPlayerInSlot(3);
                passer.Position = new Vec3(0f, 0f, 0f);
                receiver.Position = new Vec3(8f, 0f, 0f);
                defender.Position = new Vec3(4f, 0f, 0.2f);
                sim.GivePossession(passer, false);
                sim.SetHumanCommand(new PlayerCommand { Pass = true, PassDirection = new Vec3(1f, 0f, 0f) });
                var events = TestUtil.RunSeconds(sim, 1.5f);
                intercepted += TestUtil.Count(events, MatchEventType.PassIntercepted);
            }
            Assert.Greater(intercepted, 0);
            Assert.Less(intercepted, trials);
        }
    }

    public class ShotTests
    {
        [Test]
        public void Timing_Windows()
        {
            Assert.AreEqual(TimingQuality.Excellent, ShotTiming.Evaluate(0.8f, 0f));
            Assert.AreEqual(TimingQuality.Good, ShotTiming.Evaluate(0.6f, 0f));
            Assert.AreEqual(TimingQuality.Good, ShotTiming.Evaluate(1f, 0.2f));
            Assert.AreEqual(TimingQuality.Poor, ShotTiming.Evaluate(0.3f, 0f));
            Assert.AreEqual(TimingQuality.Poor, ShotTiming.Evaluate(1f, 1f), "holding a full charge too long");
            Assert.Less(ShotTiming.ErrorMultiplier(TimingQuality.Excellent), ShotTiming.ErrorMultiplier(TimingQuality.None));
            Assert.Greater(ShotTiming.ErrorMultiplier(TimingQuality.Poor), ShotTiming.ErrorMultiplier(TimingQuality.None));
        }

        [Test]
        public void ShotSpeed_DependsOnChargeAndPower()
        {
            var weak = TestUtil.MakePlayer(70);
            weak.Stats.Power = 25;
            var strong = TestUtil.MakePlayer(70);
            strong.Stats.Power = 95;
            Assert.Greater(ShotSystem.ShotSpeed(strong, 0.8f), ShotSystem.ShotSpeed(weak, 0.8f));
            Assert.Greater(ShotSystem.ShotSpeed(strong, 1f), ShotSystem.ShotSpeed(strong, 0.3f));
            Assert.That(ShotSystem.ShotSpeed(strong, 1f), Is.InRange(15f, 22f), "elite shot ~20 m/s");
        }

        /// <summary>Shoots from 7 m with the defence removed; returns how many land inside the frame.</summary>
        private static int OnTarget(int accuracy, int shots, TimingQuality timing, int humanTeam, AssistLevel assist)
        {
            var sim = TestUtil.NewSim(seed: 11, humanTeam: humanTeam, configure: c => c.Assist = assist);
            var shooter = sim.Teams[0].FieldPlayerInSlot(2);
            shooter.Stats.Accuracy = accuracy;
            shooter.Stats.Shooting = accuracy;
            int inFrame = 0;
            for (int i = 0; i < shots; i++)
            {
                shooter.Position = new Vec3(sim.Config.HalfLength - 7f, 0f, 0f);
                shooter.Stamina = 1f;
                sim.Ball.GiveTo(shooter);
                ShotSystem.Execute(sim, shooter, 0.8f, timing, new PlayerCommand());
                for (int t = 0; t < 200; t++)
                {
                    Vec3 prev = sim.Ball.Position;
                    BallPhysics.Integrate(sim.Ball, 0.02f);
                    var r = BallPhysics.CheckBoundaries(sim.Ball, prev, sim.Config, out _);
                    if (r == BoundaryResult.Goal) inFrame++;
                    if (r != BoundaryResult.None) break;
                }
            }
            return inFrame;
        }

        [Test]
        public void AccuracyStat_PutsMoreShotsOnTarget()
        {
            int good = OnTarget(95, 300, TimingQuality.None, -1, AssistLevel.Pro);
            int bad = OnTarget(25, 300, TimingQuality.None, -1, AssistLevel.Pro);
            Assert.Greater(good, bad + 30, $"good={good} bad={bad}");
        }

        [Test]
        public void ExcellentTiming_BeatsPoorTiming()
        {
            int excellent = OnTarget(60, 300, TimingQuality.Excellent, 0, AssistLevel.Pro);
            int poor = OnTarget(60, 300, TimingQuality.Poor, 0, AssistLevel.Pro);
            Assert.Greater(excellent, poor + 30, $"excellent={excellent} poor={poor}");
        }

        [Test]
        public void AssistedMode_KeepsShotsInsideTheFrame()
        {
            Assert.AreEqual(100, OnTarget(20, 100, TimingQuality.Poor, 0, AssistLevel.Assisted));
        }

        [Test]
        public void HumanChargedShot_IsTaken_OnRelease_WithTiming()
        {
            var sim = TestUtil.NewSim(seed: 5, humanTeam: 0);
            TestUtil.ParkEveryone(sim);
            var me = sim.HumanPlayer;
            me.Position = new Vec3(sim.Config.HalfLength - 6f, 0f, 0f);
            sim.GivePossession(me, false);

            for (int i = 0; i < 38; i++) // ~0.76 s: inside the excellent window
            {
                sim.SetHumanCommand(new PlayerCommand { ShootHeld = true });
                sim.Step();
            }
            Assert.IsTrue(me.IsChargingShot);
            Assert.That(me.ShotCharge, Is.InRange(ShotTiming.ExcellentMin, ShotTiming.ExcellentMax));

            sim.SetHumanCommand(new PlayerCommand { ShootHeld = false, ShootReleased = true });
            sim.Step();
            var events = new System.Collections.Generic.List<MatchEvent>();
            sim.DrainEvents(events);
            var shot = events.Find(e => e.Type == MatchEventType.ShotTaken);
            Assert.AreEqual(MatchEventType.ShotTaken, shot.Type);
            Assert.AreEqual((int)TimingQuality.Excellent, shot.OtherPlayerId);
            Assert.AreEqual(BallState.Shot, sim.Ball.State);
        }

        [Test]
        public void TapOnShoot_IsAQuickShot()
        {
            var sim = TestUtil.NewSim(seed: 5, humanTeam: 0);
            TestUtil.ParkEveryone(sim);
            var me = sim.HumanPlayer;
            me.Position = new Vec3(sim.Config.HalfLength - 6f, 0f, 0f);
            sim.GivePossession(me, false);
            sim.SetHumanCommand(new PlayerCommand { ShootReleased = true });
            sim.Step();
            Assert.AreEqual(BallState.Shot, sim.Ball.State);
        }

        [Test]
        public void TimingCanBeDisabled()
        {
            var sim = TestUtil.NewSim(seed: 5, humanTeam: 0, configure: c => c.ShotTimingEnabled = false);
            TestUtil.ParkEveryone(sim);
            var me = sim.HumanPlayer;
            me.Position = new Vec3(sim.Config.HalfLength - 6f, 0f, 0f);
            sim.GivePossession(me, false);
            for (int i = 0; i < 10; i++)
            {
                sim.SetHumanCommand(new PlayerCommand { ShootHeld = true });
                sim.Step();
            }
            sim.SetHumanCommand(new PlayerCommand());
            sim.Step();
            var events = new System.Collections.Generic.List<MatchEvent>();
            sim.DrainEvents(events);
            Assert.AreEqual((int)TimingQuality.None, events.Find(e => e.Type == MatchEventType.ShotTaken).OtherPlayerId);
        }
    }

    public class GoalkeeperTests
    {
        private static (int goals, int saves) ShootAt(int keeperRating, int trials)
        {
            int goals = 0, saves = 0;
            for (int seed = 1; seed <= trials; seed++)
            {
                var away = DemoTeams.Away();
                var gkStats = away.Players[0].Stats;
                gkStats.Goalkeeping = keeperRating;
                gkStats.Reaction = keeperRating;
                gkStats.Positioning = keeperRating;
                away.Players[0].Stats = gkStats;

                var sim = TestUtil.NewSim(seed: seed, away: away);
                TestUtil.ParkEveryone(sim);
                var gk = sim.Teams[1].Goalkeeper;
                gk.Position = new Vec3(sim.Config.HalfLength - 0.8f, 0f, 0f);
                var shooter = sim.Teams[0].FieldPlayerInSlot(2);
                shooter.Position = new Vec3(sim.Config.HalfLength - 6f, 0f, (seed % 3 - 1) * 1.5f);
                sim.GivePossession(shooter, false);
                ShotSystem.Execute(sim, shooter, 0.7f, TimingQuality.None, new PlayerCommand());

                var events = TestUtil.RunSeconds(sim, 1.5f);
                goals += TestUtil.Count(events, MatchEventType.Goal);
                saves += TestUtil.Count(events, MatchEventType.ShotSaved);
            }
            return (goals, saves);
        }

        [Test]
        public void BetterGoalkeeper_SavesMore()
        {
            var good = ShootAt(95, 80);
            var bad = ShootAt(25, 80);
            Assert.Greater(good.saves, bad.saves + 8, $"good={good} bad={bad}");
            Assert.Less(good.goals, bad.goals);
        }

        [Test]
        public void Goalkeeper_PositionsOnTheBallSide()
        {
            var sim = TestUtil.NewSim(seed: 2, humanTeam: 0);
            TestUtil.ParkEveryone(sim);
            var me = sim.HumanPlayer;
            me.Position = new Vec3(sim.Config.HalfLength - 6f, 0f, 4f);
            sim.GivePossession(me, false);
            var gk = sim.Teams[1].Goalkeeper;
            gk.Position = new Vec3(sim.Config.HalfLength - 0.8f, 0f, 0f);
            TestUtil.RunSeconds(sim, 1.5f);
            Assert.Greater(gk.Position.Z, 0.3f);
            Assert.LessOrEqual(gk.Position.Z, sim.Config.GoalWidth * 0.5f + 0.2f);
        }

        [Test]
        public void ClearlyWideShot_IsNotAttempted()
        {
            var sim = TestUtil.NewSim();
            var gk = sim.Teams[1].Goalkeeper;
            gk.Position = new Vec3(sim.Config.HalfLength - 0.8f, 0f, 0f);
            var ball = sim.Ball;
            ball.Position = new Vec3(sim.Config.HalfLength - 0.9f, 0.5f, 2.6f);
            ball.Velocity = new Vec3(15f, 0f, 0.5f);
            ball.SetState(BallState.Shot);
            Assert.AreEqual(GoalkeeperAI.SaveOutcome.NoAttempt, GoalkeeperAI.ResolveSave(sim, gk, ball));
        }
    }
}
