namespace WaterPolo.Simulation
{
    public enum PlayerRole
    {
        Goalkeeper,
        Center,
        Defender,
        Winger,
        Playmaker,
        Finisher,
        AllRounder,
    }

    public enum Personality
    {
        Leader,
        Creative,
        Calm,
        Aggressive,
        TeamPlayer,
        Tactical,
        RiskTaker,
    }

    /// <summary>
    /// How a personality bends AI decisions. All values are multipliers/offsets
    /// around neutral (1 or 0), consumed by FieldPlayerAI.
    /// </summary>
    public struct PersonalityProfile
    {
        /// <summary>Lowers (negative) or raises (positive) the shot-quality threshold.</summary>
        public float ShootThresholdOffset;
        /// <summary>Tolerance to risky passing lanes (1 = neutral).</summary>
        public float PassRisk;
        /// <summary>Multiplier on how long the player keeps the ball before releasing it.</summary>
        public float Patience;
        /// <summary>Multiplier on steal attempt frequency and foul risk.</summary>
        public float Aggression;
        /// <summary>Bonus for passing (team play) vs. individual action.</summary>
        public float PassPreference;

        public static PersonalityProfile For(Personality p)
        {
            switch (p)
            {
                case Personality.Leader:
                    return new PersonalityProfile { ShootThresholdOffset = -0.05f, PassRisk = 1.05f, Patience = 1f, Aggression = 1.1f, PassPreference = 0.05f };
                case Personality.Creative:
                    return new PersonalityProfile { ShootThresholdOffset = 0f, PassRisk = 1.35f, Patience = 0.9f, Aggression = 0.9f, PassPreference = 0.1f };
                case Personality.Calm:
                    return new PersonalityProfile { ShootThresholdOffset = 0.05f, PassRisk = 0.8f, Patience = 1.3f, Aggression = 0.7f, PassPreference = 0.05f };
                case Personality.Aggressive:
                    return new PersonalityProfile { ShootThresholdOffset = -0.08f, PassRisk = 1.1f, Patience = 0.75f, Aggression = 1.6f, PassPreference = -0.05f };
                case Personality.TeamPlayer:
                    return new PersonalityProfile { ShootThresholdOffset = 0.08f, PassRisk = 0.95f, Patience = 1f, Aggression = 1f, PassPreference = 0.2f };
                case Personality.Tactical:
                    return new PersonalityProfile { ShootThresholdOffset = 0.03f, PassRisk = 0.85f, Patience = 1.15f, Aggression = 0.9f, PassPreference = 0.1f };
                case Personality.RiskTaker:
                    return new PersonalityProfile { ShootThresholdOffset = -0.12f, PassRisk = 1.5f, Patience = 0.7f, Aggression = 1.2f, PassPreference = -0.1f };
                default:
                    return new PersonalityProfile { PassRisk = 1f, Patience = 1f, Aggression = 1f };
            }
        }
    }
}
