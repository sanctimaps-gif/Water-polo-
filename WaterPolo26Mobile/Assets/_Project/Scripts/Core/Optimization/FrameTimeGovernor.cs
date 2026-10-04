namespace WaterPolo.Core.Optimization
{
    /// <summary>
    /// Watches frame times (and an optional thermal signal) and recommends lowering
    /// or raising the active tier. Downgrades react fast (protect gameplay smoothness
    /// and avoid overheating), upgrades are slow and conservative (avoid oscillation).
    /// Only used when the player's setting is AUTO.
    /// </summary>
    public sealed class FrameTimeGovernor
    {
        public enum Recommendation { Keep, Downgrade, Upgrade }

        private readonly float _downgradeAfterSeconds;
        private readonly float _upgradeAfterSeconds;
        private float _avgFrameTime;
        private float _overBudgetTime;
        private float _underBudgetTime;
        private float _cooldown;

        public float AverageFrameTime => _avgFrameTime;

        public FrameTimeGovernor(float downgradeAfterSeconds = 4f, float upgradeAfterSeconds = 45f)
        {
            _downgradeAfterSeconds = downgradeAfterSeconds;
            _upgradeAfterSeconds = upgradeAfterSeconds;
        }

        /// <param name="frameTime">Unscaled delta time of the frame, in seconds.</param>
        /// <param name="targetFrameRate">Target of the current tier (30 or 60).</param>
        /// <param name="thermalWarning">True when the OS reports throttling / high temperature.</param>
        public Recommendation Sample(float frameTime, int targetFrameRate, bool thermalWarning)
        {
            if (frameTime <= 0f) return Recommendation.Keep;
            // Exponential moving average, ~0.5 s memory.
            _avgFrameTime = _avgFrameTime <= 0f ? frameTime : _avgFrameTime + (frameTime - _avgFrameTime) * 0.05f;

            if (_cooldown > 0f)
            {
                _cooldown -= frameTime;
                return Recommendation.Keep;
            }

            float budget = 1f / targetFrameRate;

            if (thermalWarning || _avgFrameTime > budget * 1.2f)
            {
                _overBudgetTime += frameTime * (thermalWarning ? 2f : 1f);
                _underBudgetTime = 0f;
            }
            else if (_avgFrameTime < budget * 0.7f)
            {
                _underBudgetTime += frameTime;
                _overBudgetTime = 0f;
            }
            else
            {
                _overBudgetTime = 0f;
                _underBudgetTime = 0f;
            }

            if (_overBudgetTime >= _downgradeAfterSeconds)
            {
                Reset(5f);
                return Recommendation.Downgrade;
            }

            if (!thermalWarning && _underBudgetTime >= _upgradeAfterSeconds)
            {
                Reset(10f);
                return Recommendation.Upgrade;
            }

            return Recommendation.Keep;
        }

        private void Reset(float cooldown)
        {
            _overBudgetTime = 0f;
            _underBudgetTime = 0f;
            _cooldown = cooldown;
        }
    }
}
