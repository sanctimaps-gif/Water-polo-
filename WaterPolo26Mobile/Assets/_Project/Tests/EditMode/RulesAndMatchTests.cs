using System;
using System.Collections.Generic;
using NUnit.Framework;
using WaterPolo.Core;
using WaterPolo.Simulation;

namespace WaterPolo.Tests
{
    public class RulesTests
    {
        [Test]
        public void Match_PlaysAllPeriods_AndEnds()
        {
            var sim = TestUtil.NewSim(seed: 4, configure: c => c.PeriodDuration = 30f);
            var events = TestUtil.RunToEnd(sim);
            Assert.IsTrue(sim.IsFinished);
            Assert.AreEqual(MatchPhase.Ended, sim.Rules.Phase);
            Assert.AreEqual(4, TestUtil.Count(events, MatchEventType.PeriodStart));
            Assert.AreEqual(4, TestUtil.Count(events, MatchEventType.SwimOff));
            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.MatchEnd));
            Assert.AreEqual(sim.Teams[0].Score + sim.Teams[1].Score, TestUtil.Count(events, MatchEventType.Goal));
        }

        [Test]
        public void SwimOff_BallStartsFreeAtCentre_AndIsWon()
        {
            var sim = TestUtil.NewSim(seed: 9);
            sim.Step();
            Assert.AreEqual(MatchPhase.Live, sim.Rules.Phase);
            Assert.AreEqual(0f, sim.Ball.Position.X, 0.01f);
            Assert.AreEqual(BallState.Free, sim.Ball.State);
            foreach (var p in sim.Players)
                Assert.Greater(Math.Abs(p.Position.X), 10f, "everyone starts on their goal line");

            var events = TestUtil.RunSeconds(sim, 12f);
            Assert.GreaterOrEqual(TestUtil.Count(events, MatchEventType.PossessionWon), 1);
        }

        [Test]
        public void Goal_IncrementsScore_AndConcedingTeamRestartsAtCentre()
        {
            var sim = TestUtil.NewSim(seed: 2);
            TestUtil.ParkEveryone(sim);
            var shooter = sim.Teams[0].FieldPlayerInSlot(2);
            sim.Teams[1].Goalkeeper.Position = new Vec3(sim.Config.HalfLength - 1f, 0f, -9f);
            shooter.Position = new Vec3(sim.Config.HalfLength - 3f, 0f, 0f);
            sim.GivePossession(shooter, false);
            ShotSystem.Execute(sim, shooter, 0.8f, TimingQuality.Excellent, new PlayerCommand { HasAim = true, AimX = 0f, AimY = 0.3f });

            var events = TestUtil.RunSeconds(sim, 1f);
            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.Goal));
            Assert.AreEqual(1, sim.Teams[0].Score);
            Assert.AreEqual(MatchPhase.GoalPause, sim.Rules.Phase);
            Assert.AreEqual(shooter.Id, events.Find(e => e.Type == MatchEventType.Goal).PlayerId);

            events = TestUtil.RunSeconds(sim, sim.Config.GoalPauseDuration + 0.1f);
            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.Restart));
            Assert.AreEqual(MatchPhase.Live, sim.Rules.Phase);
            Assert.IsNotNull(sim.Ball.Owner);
            Assert.AreEqual(1, sim.Ball.Owner.TeamIndex, "conceding team restarts");
            Assert.Less(Math.Abs(sim.Ball.Owner.Position.X), 1.5f);
        }

        [Test]
        public void ShotClock_Violation_GivesTheBallToTheOtherTeam()
        {
            var sim = TestUtil.NewSim(seed: 2, humanTeam: 0, configure: c => c.ShotClock = 1.5f);
            TestUtil.ParkEveryone(sim);
            var me = sim.HumanPlayer;
            me.Position = new Vec3(-8f, 0f, 8f);
            sim.GivePossession(me, false);

            var events = TestUtil.RunSeconds(sim, 1.5f + sim.Config.DeadBallPauseDuration + 0.3f);
            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.ShotClockViolation));
            Assert.IsNotNull(sim.Ball.Owner);
            Assert.AreEqual(1, sim.Ball.Owner.TeamIndex);
        }

        [Test]
        public void ShotClock_ResetsOnPossessionChange()
        {
            var sim = TestUtil.NewSim(seed: 2);
            TestUtil.RunSeconds(sim, 1f);
            sim.GivePossession(sim.Teams[0].FieldPlayers[0], true);
            TestUtil.RunSeconds(sim, 0.2f);
            sim.GivePossession(sim.Teams[1].FieldPlayers[0], true);
            Assert.AreEqual(sim.Config.ShotClock, sim.Rules.ShotClockRemaining, 0.01f);
        }

        [Test]
        public void BallOverTheSideLine_GoesToTheOtherTeam()
        {
            var sim = TestUtil.NewSim(seed: 6);
            TestUtil.ParkEveryone(sim);
            var p = sim.Teams[0].FieldPlayerInSlot(2);
            p.Position = new Vec3(0f, 0f, 8f);
            sim.GivePossession(p, false);
            sim.Ball.Release(BallState.Passed, new Vec3(0f, 2f, 10f));

            var events = TestUtil.RunSeconds(sim, 0.5f + sim.Config.DeadBallPauseDuration + 0.3f);
            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.BallOut));
            Assert.AreEqual(1, sim.Ball.Owner.TeamIndex);
        }

        [Test]
        public void WideShot_GivesAGoalThrowToTheDefendingKeeper()
        {
            var sim = TestUtil.NewSim(seed: 6);
            TestUtil.ParkEveryone(sim);
            var p = sim.Teams[0].FieldPlayerInSlot(2);
            p.Position = new Vec3(sim.Config.HalfLength - 4f, 0f, 0f);
            sim.GivePossession(p, false);
            sim.Ball.Shooter = p;
            sim.Ball.Release(BallState.Shot, new Vec3(14f, 0.5f, 10f));

            var events = TestUtil.RunSeconds(sim, 0.6f + sim.Config.DeadBallPauseDuration + 0.3f);
            Assert.AreEqual(1, TestUtil.Count(events, MatchEventType.BallOut));
            Assert.AreEqual(sim.Teams[1].Goalkeeper, sim.Ball.Owner);
        }

        [Test]
        public void Foul_GivesAFreeThrowToTheFouledPlayer()
        {
            var sim = TestUtil.NewSim(seed: 6);
            var carrier = sim.Teams[0].FieldPlayerInSlot(2);
            sim.GivePossession(carrier, false);
            sim.Rules.OnFoul(carrier);
            Assert.AreEqual(MatchPhase.DeadBall, sim.Rules.Phase);
            TestUtil.RunSeconds(sim, 0.7f);
            Assert.AreEqual(MatchPhase.Live, sim.Rules.Phase);
            Assert.AreEqual(carrier, sim.Ball.Owner);
        }
    }

    public class MatchTests
    {
        private static MatchSimulation PlayFull(int seed, TeamDefinition home = null, TeamDefinition away = null, float period = 120f)
        {
            var sim = TestUtil.NewSim(seed: seed, home: home, away: away, configure: c => c.PeriodDuration = period);
            TestUtil.RunToEnd(sim);
            return sim;
        }

        [Test]
        public void SameSeed_ReplaysTheSameMatch()
        {
            var a = PlayFull(77);
            var b = PlayFull(77);
            Assert.AreEqual(a.Teams[0].Score, b.Teams[0].Score);
            Assert.AreEqual(a.Teams[1].Score, b.Teams[1].Score);
            Assert.AreEqual(a.TickCount, b.TickCount);
            Assert.AreEqual(a.Ball.Position, b.Ball.Position);
            for (int i = 0; i < a.Players.Count; i++)
                Assert.AreEqual(a.Players[i].Position, b.Players[i].Position);
            Assert.AreEqual(a.Stats.Teams[0].Passes, b.Stats.Teams[0].Passes);
        }

        [Test]
        public void DifferentSeeds_GiveDifferentMatches()
        {
            var a = PlayFull(1, period: 30f);
            var b = PlayFull(2, period: 30f);
            Assert.AreNotEqual(a.Ball.Position, b.Ball.Position);
        }

        [Test]
        public void FullMatch_StateStaysValid()
        {
            var sim = TestUtil.NewSim(seed: 31);
            int guard = 0;
            var cfg = sim.Config;
            while (!sim.IsFinished && guard++ < 100000)
            {
                sim.Step();
                foreach (var p in sim.Players)
                {
                    Assert.IsFalse(float.IsNaN(p.Position.X) || float.IsNaN(p.Position.Z), "NaN position");
                    Assert.LessOrEqual(Math.Abs(p.Position.X), cfg.HalfLength);
                    Assert.LessOrEqual(Math.Abs(p.Position.Z), cfg.HalfWidth);
                    Assert.That(p.Stamina, Is.InRange(0f, 1f));
                }
                Assert.IsFalse(float.IsNaN(sim.Ball.Position.X), "NaN ball");
                Assert.GreaterOrEqual(sim.Ball.Position.Y, SimBall.Radius - 1e-3f, "ball never sinks");
                if (sim.Ball.State == BallState.Possessed) Assert.IsNotNull(sim.Ball.Owner);
            }
            Assert.IsTrue(sim.IsFinished);
        }

        [Test]
        public void Balance_LooksLikeWaterPolo()
        {
            int matches = 10, goals = 0, shots = 0, passes = 0, completed = 0, saves = 0;
            for (int s = 1; s <= matches; s++)
            {
                var sim = PlayFull(s);
                foreach (var t in sim.Stats.Teams)
                {
                    goals += t.Goals; shots += t.Shots; passes += t.Passes; completed += t.PassesCompleted; saves += t.Saves;
                }
            }
            float goalsPerMatch = goals / (float)matches;
            float conversion = goals / (float)shots;
            float passAccuracy = completed / (float)passes;
            TestContext.WriteLine($"goals/match={goalsPerMatch:0.0} conversion={conversion:0.00} passAcc={passAccuracy:0.00} saves={saves}");
            Assert.That(goalsPerMatch, Is.InRange(3f, 20f));
            Assert.That(conversion, Is.InRange(0.2f, 0.6f));
            Assert.That(passAccuracy, Is.InRange(0.7f, 0.95f));
            Assert.Greater(saves, matches * 4);
        }

        [Test]
        public void StrongerTeam_WinsMoreOften()
        {
            int strongWins = 0, weakWins = 0;
            for (int s = 1; s <= 10; s++)
            {
                var sim = PlayFull(s, TestUtil.TeamWithRating(88, 500 + s), TestUtil.TeamWithRating(55, 600 + s));
                if (sim.Teams[0].Score > sim.Teams[1].Score) strongWins++;
                if (sim.Teams[0].Score < sim.Teams[1].Score) weakWins++;
            }
            Assert.GreaterOrEqual(strongWins, 7, $"strong={strongWins} weak={weakWins}");
        }

        [Test]
        public void CpuDifficulty_ChangesResults()
        {
            int easyGoalsAgainst = 0, hardGoalsAgainst = 0;
            for (int s = 1; s <= 8; s++)
            {
                // Team 0 marked "human" but driven by AI here: only difficulty differs.
                var easy = TestUtil.NewSim(seed: s, humanTeam: 0, configure: c => c.CpuDifficulty = 0.7f);
                var hard = TestUtil.NewSim(seed: s, humanTeam: 0, configure: c => c.CpuDifficulty = 1.15f);
                foreach (var sim in new[] { easy, hard })
                {
                    while (!sim.IsFinished)
                    {
                        // Let the AI drive the human slot too (empty command = idle, so use AI each tick).
                        sim.HumanPlayer.IsHumanControlled = false;
                        sim.Step();
                    }
                }
                easyGoalsAgainst += easy.Teams[1].Score - easy.Teams[0].Score;
                hardGoalsAgainst += hard.Teams[1].Score - hard.Teams[0].Score;
            }
            Assert.Greater(hardGoalsAgainst, easyGoalsAgainst);
        }

        [Test]
        public void HumanSwitch_SelectsAnotherPlayer()
        {
            var sim = TestUtil.NewSim(seed: 3, humanTeam: 0);
            var opp = sim.Teams[1].FieldPlayerInSlot(2);
            sim.GivePossession(opp, false);
            var before = sim.HumanPlayer;
            sim.SwitchHumanPlayer();
            Assert.AreNotEqual(before, sim.HumanPlayer);
            Assert.IsTrue(sim.HumanPlayer.IsHumanControlled);
            Assert.IsFalse(before.IsHumanControlled);
            Assert.AreEqual(0, sim.HumanPlayer.TeamIndex);
        }

        [Test]
        public void HumanDefend_CanStealTheBall()
        {
            int steals = 0;
            for (int seed = 1; seed <= 30; seed++)
            {
                var sim = TestUtil.NewSim(seed: seed, humanTeam: 0);
                TestUtil.ParkEveryone(sim);
                var me = sim.HumanPlayer;
                var carrier = sim.Teams[1].FieldPlayerInSlot(2);
                carrier.Position = new Vec3(0f, 0f, 0f);
                me.Position = new Vec3(0.8f, 0f, 0f);
                sim.GivePossession(carrier, false);
                sim.SetHumanCommand(new PlayerCommand { Defend = true });
                var events = TestUtil.RunSeconds(sim, 0.1f);
                steals += TestUtil.Count(events, MatchEventType.Steal);
            }
            Assert.Greater(steals, 0);
            Assert.Less(steals, 30);
        }
    }

    public class TacticTests
    {
        private static TeamMatchStats PlayWithTactic(TacticStyle tactic, int seeds, out float avgDefDepth)
        {
            var total = new TeamMatchStats();
            double depthSum = 0;
            int depthSamples = 0;
            for (int s = 1; s <= seeds; s++)
            {
                var home = DemoTeams.Home();
                home.Tactic = tactic;
                var sim = TestUtil.NewSim(seed: s, home: home);
                while (!sim.IsFinished)
                {
                    sim.Step();
                    if (sim.TickCount % 25 == 0 && sim.Rules.IsLive && sim.Ball.Owner != null && sim.Ball.Owner.TeamIndex == 1)
                    {
                        Vec3 goal = sim.Config.OwnGoalCenter(0);
                        foreach (var p in sim.Teams[0].FieldPlayers) depthSum += Vec3.FlatDistance(p.Position, goal);
                        depthSamples += 6;
                    }
                }
                var t = sim.Stats.Teams[0];
                total.Shots += t.Shots; total.Steals += t.Steals; total.Fouls += t.Fouls;
                total.CenterFeeds += t.CenterFeeds; total.Passes += t.Passes; total.Goals += t.Goals;
            }
            avgDefDepth = (float)(depthSum / Math.Max(1, depthSamples));
            return total;
        }

        [Test]
        public void Tactics_ReallyChangeBehaviour()
        {
            const int seeds = 6;
            var balanced = PlayWithTactic(TacticStyle.Balanced, seeds, out float balancedDepth);
            var center = PlayWithTactic(TacticStyle.Center, seeds, out _);
            var defensive = PlayWithTactic(TacticStyle.Defensive, seeds, out float defensiveDepth);
            var pressure = PlayWithTactic(TacticStyle.Pressure, seeds, out _);
            var offensive = PlayWithTactic(TacticStyle.Offensive, seeds, out _);

            TestContext.WriteLine($"centerFeeds bal={balanced.CenterFeeds} center={center.CenterFeeds}");
            TestContext.WriteLine($"defDepth bal={balancedDepth:0.0} def={defensiveDepth:0.0}");
            TestContext.WriteLine($"steals+fouls bal={balanced.Steals + balanced.Fouls} press={pressure.Steals + pressure.Fouls}");
            TestContext.WriteLine($"shots bal={balanced.Shots} off={offensive.Shots}");

            Assert.Greater(center.CenterFeeds, balanced.CenterFeeds, "CENTRE feeds the centre-forward more");
            Assert.Less(defensiveDepth, balancedDepth, "DÉFENSIF defends closer to its goal");
            Assert.Greater(pressure.Steals + pressure.Fouls, balanced.Steals + balanced.Fouls, "PRESSION contests the ball more");
            Assert.Greater(offensive.Shots, balanced.Shots, "OFFENSIF shoots more");
        }
    }

    /// <summary>"Chaque statistique doit avoir un effet réel": one check per attribute.</summary>
    public class StatImpactTests
    {
        private static SimPlayer With(Action<SimPlayer> set)
        {
            var p = TestUtil.MakePlayer(60);
            set(p);
            return p;
        }

        private static void AssertMatters(string stat, Func<SimPlayer, float> measure, Action<SimPlayer, int> set, bool higherIsBetter = true)
        {
            float low = measure(With(p => set(p, 20)));
            float high = measure(With(p => set(p, 95)));
            if (higherIsBetter) Assert.Greater(high, low, stat);
            else Assert.Less(high, low, stat);
        }

        [Test]
        public void EveryStatisticHasAnEffect()
        {
            AssertMatters("Speed", SwimmerMotor.BaseMaxSpeed, (p, v) => p.Stats.Speed = v);
            AssertMatters("Acceleration", SwimmerMotor.Acceleration, (p, v) => p.Stats.Acceleration = v);
            AssertMatters("Stamina", SwimmerMotor.SprintDrainPerSecond, (p, v) => p.Stats.Stamina = v, higherIsBetter: false);
            AssertMatters("Passing", p => PassSystem.PassSpeed(p, 6f, false), (p, v) => p.Stats.Passing = v);
            AssertMatters("Shooting", ShotSystem.BaseSpread, (p, v) => p.Stats.Shooting = v, higherIsBetter: false);
            AssertMatters("Power", p => ShotSystem.ShotSpeed(p, 0.8f), (p, v) => p.Stats.Power = v);
            AssertMatters("Accuracy", ShotSystem.BaseSpread, (p, v) => p.Stats.Accuracy = v, higherIsBetter: false);
            var carrier = TestUtil.MakePlayer(60);
            AssertMatters("Defense", p => Duels.StealChance(p, carrier, 1f), (p, v) => p.Stats.Defense = v);
            AssertMatters("Reaction", p => p.ReactionTime, (p, v) => p.Stats.Reaction = v, higherIsBetter: false);
            AssertMatters("Positioning", FieldPlayerAI.PositioningError, (p, v) => p.Stats.Positioning = v, higherIsBetter: false);
            AssertMatters("Technique", SwimmerMotor.TurnRate, (p, v) => p.Stats.Technique = v);
            AssertMatters("Intelligence", p => FieldPlayerAI.DecisionInterval(PlayerStats.N(p.Stats.Intelligence)), (p, v) => p.Stats.Intelligence = v, higherIsBetter: false);
            var defender = TestUtil.MakePlayer(60);
            AssertMatters("Physical", p => Duels.StealChance(defender, p, 1f), (p, v) => p.Stats.Physical = v, higherIsBetter: false);
            AssertMatters("Goalkeeping", GoalkeeperAI.DiveSpeed, (p, v) => p.Stats.Goalkeeping = v);
        }
    }
}
