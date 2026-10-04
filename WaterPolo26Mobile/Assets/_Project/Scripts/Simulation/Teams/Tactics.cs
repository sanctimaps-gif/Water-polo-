namespace WaterPolo.Simulation
{
    public enum TacticStyle
    {
        Balanced,
        Fast,
        Offensive,
        Defensive,
        Pressure,
        Center,
        CounterAttack,
    }

    /// <summary>
    /// Numbers that the AI reads every decision. Each style is a different set of
    /// numbers, so changing tactic genuinely changes team behaviour (covered by tests).
    /// </summary>
    public struct TacticParams
    {
        /// <summary>How close to the opponent goal the attacking shape sits (1 = normal, &gt;1 = deeper into the 2 m–5 m zone).</summary>
        public float AttackDepth;
        /// <summary>Lateral spread of the attacking shape.</summary>
        public float Width;
        /// <summary>Multiplier on how long the carrier holds the ball before moving it.</summary>
        public float Tempo;
        /// <summary>Offset on the shot-quality threshold (negative = shoot more).</summary>
        public float ShootThresholdOffset;
        /// <summary>Marking distance in metres (smaller = tighter).</summary>
        public float MarkDistance;
        /// <summary>0 = pure man-to-man, 1 = defenders collapse in front of their goal (zone).</summary>
        public float ZoneDrop;
        /// <summary>Score bonus for passes to the centre-forward in the 2 m zone.</summary>
        public float CenterFeedBonus;
        /// <summary>Sprint usage in transition (0..1).</summary>
        public float TransitionSprint;
        /// <summary>Probability-ish factor for steal attempts.</summary>
        public float PressIntensity;
        /// <summary>Number of field players that stay back when attacking (counter-attack safety).</summary>
        public int SafetyPlayers;
        /// <summary>0 = defend goal-side of the mark, 1 = front the mark on the ball side to deny passes.</summary>
        public float Denial;

        public static TacticParams For(TacticStyle style)
        {
            var t = new TacticParams
            {
                AttackDepth = 1f, Width = 1f, Tempo = 1f, ShootThresholdOffset = 0f, MarkDistance = 1.1f,
                ZoneDrop = 0.15f, CenterFeedBonus = 0.15f, TransitionSprint = 0.5f, PressIntensity = 1f, SafetyPlayers = 0,
                Denial = 0.15f,
            };

            switch (style)
            {
                case TacticStyle.Fast:
                    t.Tempo = 0.6f; t.TransitionSprint = 0.85f; t.ShootThresholdOffset = -0.04f;
                    break;
                case TacticStyle.Offensive:
                    t.AttackDepth = 1.15f; t.ShootThresholdOffset = -0.1f; t.ZoneDrop = 0.05f; t.MarkDistance = 1.3f;
                    break;
                case TacticStyle.Defensive:
                    t.AttackDepth = 0.85f; t.ShootThresholdOffset = 0.08f; t.ZoneDrop = 0.65f; t.MarkDistance = 1.2f; t.Denial = 0f;
                    t.Tempo = 1.25f; t.PressIntensity = 0.7f; t.SafetyPlayers = 1;
                    break;
                case TacticStyle.Pressure:
                    t.MarkDistance = 0.8f; t.PressIntensity = 1.6f; t.ZoneDrop = 0.15f; t.TransitionSprint = 0.7f;
                    t.Denial = 0.5f;
                    break;
                case TacticStyle.Center:
                    t.CenterFeedBonus = 0.6f; t.Width = 1.15f; t.Tempo = 1.1f;
                    break;
                case TacticStyle.CounterAttack:
                    t.TransitionSprint = 1f; t.Tempo = 0.75f; t.ZoneDrop = 0.35f; t.SafetyPlayers = 0;
                    t.ShootThresholdOffset = -0.03f;
                    break;
            }

            return t;
        }
    }
}
