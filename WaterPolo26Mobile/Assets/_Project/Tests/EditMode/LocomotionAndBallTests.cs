using NUnit.Framework;
using WaterPolo.Core;
using WaterPolo.Simulation;

namespace WaterPolo.Tests
{
    public class LocomotionTests
    {
        private const float Dt = 1f / 50f;

        private static float TopSpeedAfter(SimPlayer p, float seconds, bool sprint = false, bool hasBall = false)
        {
            for (int i = 0; i < (int)(seconds / Dt); i++) SwimmerMotor.Step(p, new Vec3(1f, 0f, 0f), sprint, hasBall, Dt);
            return p.Velocity.Magnitude;
        }

        [Test]
        public void Movement_HasInertia_NoInstantSpeed()
        {
            var p = TestUtil.MakePlayer();
            SwimmerMotor.Step(p, new Vec3(1f, 0f, 0f), false, false, Dt);
            Assert.Less(p.Velocity.Magnitude, SwimmerMotor.MaxSpeed(p, false) * 0.2f, "one tick must not reach top speed");
            float v = TopSpeedAfter(p, 2f);
            Assert.AreEqual(SwimmerMotor.MaxSpeed(p, false), v, 0.02f, "top speed is reached after a while");
        }

        [Test]
        public void Movement_WaterDragStopsSwimmerWithoutInput()
        {
            var p = TestUtil.MakePlayer();
            TopSpeedAfter(p, 2f);
            SwimmerMotor.Step(p, Vec3.Zero, false, false, Dt);
            Assert.Greater(p.Velocity.Magnitude, 0.5f, "glides a little");
            for (int i = 0; i < 100; i++) SwimmerMotor.Step(p, Vec3.Zero, false, false, Dt);
            Assert.AreEqual(0f, p.Velocity.Magnitude, 1e-3f);
        }

        [Test]
        public void Speed_And_Acceleration_Stats_Matter()
        {
            var slow = TestUtil.MakePlayer(40);
            var fast = TestUtil.MakePlayer(90);
            Assert.Greater(TopSpeedAfter(fast, 3f), TopSpeedAfter(slow, 3f));

            var lowAcc = TestUtil.MakePlayer(70);
            lowAcc.Stats.Acceleration = 30;
            var highAcc = TestUtil.MakePlayer(70);
            highAcc.Stats.Acceleration = 95;
            Assert.Greater(TopSpeedAfter(highAcc, 0.3f), TopSpeedAfter(lowAcc, 0.3f));
        }

        [Test]
        public void Sprint_IsFaster_AndDrainsStamina()
        {
            var normal = TestUtil.MakePlayer();
            var sprinter = TestUtil.MakePlayer();
            float vNormal = TopSpeedAfter(normal, 2f);
            float vSprint = TopSpeedAfter(sprinter, 2f, sprint: true);
            Assert.Greater(vSprint, vNormal * 1.2f);
            Assert.Less(sprinter.Stamina, normal.Stamina);
        }

        [Test]
        public void Sprint_LocksWhenExhausted_ThenRecovers()
        {
            var p = TestUtil.MakePlayer(50);
            int ticks = 0;
            while (!p.SprintLocked && ticks++ < 50 * 60)
                SwimmerMotor.Step(p, new Vec3(1f, 0f, 0f), true, false, Dt);
            Assert.IsTrue(p.SprintLocked, "sprinting long enough exhausts the player");
            Assert.Greater(ticks, 50 * 5, "but not within a few seconds");
            Assert.IsFalse(p.IsSprinting);
            SwimmerMotor.Step(p, new Vec3(1f, 0f, 0f), true, false, Dt);
            Assert.IsFalse(p.IsSprinting, "still locked right after exhaustion");

            for (int i = 0; i < 50 * 20; i++) SwimmerMotor.Step(p, Vec3.Zero, true, false, Dt);
            Assert.IsFalse(p.SprintLocked);
            Assert.Greater(p.Stamina, SwimmerMotor.SprintUnlockStamina);
        }

        [Test]
        public void StaminaStat_ReducesSprintDrain()
        {
            var weak = TestUtil.MakePlayer(70);
            weak.Stats.Stamina = 30;
            var strong = TestUtil.MakePlayer(70);
            strong.Stats.Stamina = 95;
            TopSpeedAfter(weak, 5f, sprint: true);
            TopSpeedAfter(strong, 5f, sprint: true);
            Assert.Greater(strong.Stamina, weak.Stamina);
        }

        [Test]
        public void Fatigue_ReducesTopSpeedAndPrecision()
        {
            var fresh = TestUtil.MakePlayer();
            var tired = TestUtil.MakePlayer();
            tired.Stamina = 0.1f;
            Assert.Less(SwimmerMotor.MaxSpeed(tired, false), SwimmerMotor.MaxSpeed(fresh, false));
            Assert.Less(tired.EffectiveAccuracy, fresh.EffectiveAccuracy);
            Assert.Less(tired.EffectivePower, fresh.EffectivePower);
            Assert.Greater(tired.ReactionTime, fresh.ReactionTime);
        }

        [Test]
        public void CarryingTheBall_IsSlower()
        {
            var p = TestUtil.MakePlayer();
            Assert.Less(SwimmerMotor.MaxSpeed(p, true), SwimmerMotor.MaxSpeed(p, false));
        }

        [Test]
        public void Turning_IsRateLimited_ByTechnique()
        {
            var clumsy = TestUtil.MakePlayer(70);
            clumsy.Stats.Technique = 20;
            var skilled = TestUtil.MakePlayer(70);
            skilled.Stats.Technique = 95;
            foreach (var p in new[] { clumsy, skilled })
            {
                p.Facing = new Vec3(1f, 0f, 0f);
                SwimmerMotor.Step(p, new Vec3(-1f, 0f, 0f), false, false, Dt);
            }
            Assert.Greater(clumsy.Facing.X, skilled.Facing.X, "skilled player turns further in one tick");
            Assert.Greater(clumsy.Facing.X, 0.5f, "no instant 180° turn");
        }
    }

    public class BallTests
    {
        private static readonly MatchConfig Cfg = new MatchConfig();

        private static BoundaryResult Throw(Vec3 from, Vec3 velocity, out SimBall ball, int maxTicks = 200)
        {
            ball = new SimBall { Position = from, Velocity = velocity };
            ball.SetState(BallState.Shot);
            for (int i = 0; i < maxTicks; i++)
            {
                Vec3 prev = ball.Position;
                BallPhysics.Integrate(ball, Cfg.FixedDeltaTime);
                var r = BallPhysics.CheckBoundaries(ball, prev, Cfg, out _);
                if (r != BoundaryResult.None) return r;
            }
            return BoundaryResult.None;
        }

        [Test]
        public void ShotInsideTheFrame_IsAGoal()
        {
            var from = new Vec3(Cfg.HalfLength - 5f, 0.5f, 0f);
            var to = new Vec3(Cfg.HalfLength + 0.3f, 0.5f, 0.6f);
            var v = BallPhysics.BallisticVelocity(from, to, 15f, out _);
            Assert.AreEqual(BoundaryResult.Goal, Throw(from, v, out var ball));
            Assert.Greater(ball.Position.X, Cfg.HalfLength);
        }

        [Test]
        public void WideShot_IsOutOnTheGoalLine()
        {
            var from = new Vec3(Cfg.HalfLength - 5f, 0.5f, 0f);
            var to = new Vec3(Cfg.HalfLength + 0.3f, 0.5f, 3f);
            var v = BallPhysics.BallisticVelocity(from, to, 15f, out _);
            Assert.AreEqual(BoundaryResult.OutGoalLine, Throw(from, v, out _));
        }

        [Test]
        public void ShotOnThePost_BouncesBackIntoPlay()
        {
            float postZ = Cfg.GoalWidth * 0.5f;
            var from = new Vec3(Cfg.HalfLength - 5f, 0.5f, postZ);
            var to = new Vec3(Cfg.HalfLength + 0.3f, 0.5f, postZ);
            var v = BallPhysics.BallisticVelocity(from, to, 15f, out _);
            Assert.AreEqual(BoundaryResult.Frame, Throw(from, v, out var ball));
            Assert.Less(ball.Velocity.X, 0f, "ball comes back toward the field");
            Assert.Less(ball.Position.X, Cfg.HalfLength);
        }

        [Test]
        public void ShotOverTheBar_IsOut()
        {
            var from = new Vec3(Cfg.HalfLength - 5f, 0.5f, 0f);
            var to = new Vec3(Cfg.HalfLength + 0.3f, 1.4f, 0f);
            var v = BallPhysics.BallisticVelocity(from, to, 15f, out _);
            Assert.AreEqual(BoundaryResult.OutGoalLine, Throw(from, v, out _));
        }

        [Test]
        public void SideLine_IsOut()
        {
            Assert.AreEqual(BoundaryResult.OutSide, Throw(new Vec3(0f, 0.3f, 8f), new Vec3(0f, 0f, 8f), out _));
        }

        [Test]
        public void Ball_LandsAndFloats_ThenWaterDragStopsIt()
        {
            var ball = new SimBall { Position = new Vec3(0f, 1.5f, 0f), Velocity = new Vec3(4f, 0f, 0f) };
            ball.SetState(BallState.Passed);
            for (int i = 0; i < 400; i++) BallPhysics.Integrate(ball, 0.02f);
            Assert.AreEqual(SimBall.Radius, ball.Position.Y, 1e-4f, "floats on the surface");
            Assert.Less(ball.Velocity.Magnitude, 0.05f, "water drag stops it");
            Assert.IsTrue(BallPhysics.IsOnWater(ball));
        }

        [Test]
        public void FastSteepBall_SkipsOnTheWater()
        {
            var ball = new SimBall { Position = new Vec3(0f, 0.5f, 0f), Velocity = new Vec3(10f, -6f, 0f) };
            ball.SetState(BallState.Shot);
            bool wentUpAgain = false;
            for (int i = 0; i < 20; i++)
            {
                BallPhysics.Integrate(ball, 0.02f);
                if (ball.Velocity.Y > 0f) wentUpAgain = true;
            }
            Assert.IsTrue(wentUpAgain);
        }

        [Test]
        public void BallisticVelocity_ReachesTarget()
        {
            var from = new Vec3(0f, 0.45f, 0f);
            var to = new Vec3(8f, 0.6f, 3f);
            var v = BallPhysics.BallisticVelocity(from, to, 10f, out float t);
            var ball = new SimBall { Position = from, Velocity = v };
            ball.SetState(BallState.Passed);
            int ticks = (int)System.MathF.Round(t / 0.01f);
            for (int i = 0; i < ticks; i++) BallPhysics.Integrate(ball, 0.01f);
            Assert.Less(Vec3.Distance(ball.Position, to), 0.25f);
        }
    }
}
