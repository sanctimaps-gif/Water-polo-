using System;
using System.Collections.Generic;
using UnityEngine;
using WaterPolo.Core;
using WaterPolo.Simulation;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Bridges Unity and the deterministic simulation: runs it at a fixed rate,
    /// feeds the human command, keeps two snapshots for smooth interpolation at any
    /// display frame rate (30/60/120 Hz), and re-broadcasts match events.
    /// </summary>
    public sealed class MatchRunner : MonoBehaviour
    {
        private const int MaxStepsPerFrame = 5;

        public MatchSimulation Sim { get; private set; }
        public HumanInputController Input { get; set; }
        public bool Paused { get; set; }

        /// <summary>Raised on the main thread for every simulation event (HUD, camera, audio, haptics, analytics).</summary>
        public event Action<MatchEvent> MatchEventRaised;

        private readonly List<MatchEvent> _events = new List<MatchEvent>();
        private Vec3[] _prevPlayers;
        private Vec3[] _currPlayers;
        private Vec3 _prevBall;
        private Vec3 _currBall;
        private float _accumulator;

        public float Alpha => Sim == null ? 1f : Mathf.Clamp01(_accumulator / Sim.Config.FixedDeltaTime);

        public void StartNewMatch(MatchConfig config, TeamDefinition home, TeamDefinition away)
        {
            Sim = new MatchSimulation(config, home, away);
            Sim.StartMatch();
            int n = Sim.Players.Count;
            _prevPlayers = new Vec3[n];
            _currPlayers = new Vec3[n];
            Snapshot(_currPlayers, ref _currBall);
            Snapshot(_prevPlayers, ref _prevBall);
            _accumulator = 0f;
            Paused = false;
        }

        private void Update()
        {
            if (Sim == null || Paused) return;

            if (Input != null) Input.Poll(Sim);

            float dt = Sim.Config.FixedDeltaTime;
            _accumulator += Mathf.Min(Time.deltaTime, 0.25f);
            int steps = 0;
            while (_accumulator >= dt && steps < MaxStepsPerFrame)
            {
                Snapshot(_prevPlayers, ref _prevBall);
                Sim.Step();
                Snapshot(_currPlayers, ref _currBall);
                _accumulator -= dt;
                steps++;
            }
            if (steps == MaxStepsPerFrame) _accumulator = 0f; // device too slow: drop time rather than spiral

            _events.Clear();
            Sim.DrainEvents(_events);
            foreach (var e in _events) MatchEventRaised?.Invoke(e);
        }

        private void Snapshot(Vec3[] players, ref Vec3 ball)
        {
            for (int i = 0; i < players.Length; i++) players[i] = Sim.Players[i].Position;
            ball = Sim.Ball.Position;
        }

        public Vector3 GetPlayerPosition(int id)
        {
            Vec3 v = Vec3.Lerp(_prevPlayers[id], _currPlayers[id], Alpha);
            return new Vector3(v.X, v.Y, v.Z);
        }

        public Vector3 GetBallPosition()
        {
            // A teleport (restart, goal) must not be interpolated across the pool.
            if (Vec3.Distance(_prevBall, _currBall) > 3f) return ToUnity(_currBall);
            return ToUnity(Vec3.Lerp(_prevBall, _currBall, Alpha));
        }

        public static Vector3 ToUnity(Vec3 v) => new Vector3(v.X, v.Y, v.Z);
        public static Vec3 ToSim(Vector3 v) => new Vec3(v.x, v.y, v.z);
    }
}
