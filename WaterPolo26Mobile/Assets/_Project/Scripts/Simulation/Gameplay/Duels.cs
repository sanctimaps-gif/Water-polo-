using WaterPolo.Core;

namespace WaterPolo.Simulation
{
    /// <summary>
    /// Contested-ball formulas (steal, foul, interception, block, catch), kept in one
    /// place so balancing and tests read the same numbers the simulation uses.
    /// </summary>
    public static class Duels
    {
        public const float StealRange = 1.15f;

        public static float StealChance(SimPlayer defender, SimPlayer carrier, float skillScale)
        {
            float p = 0.12f + 0.4f * defender.EffectiveDefense * skillScale
                      - 0.25f * PlayerStats.N(carrier.Stats.Physical)
                      - 0.1f * PlayerStats.N(carrier.Stats.Technique);
            return FMath.Clamp(p, 0.04f, 0.55f);
        }

        /// <summary>Chance that a failed steal is whistled as an ordinary foul.</summary>
        public static float FoulChance(SimPlayer defender, SimPlayer carrier)
        {
            return 0.28f * defender.Profile.Aggression
                   * FMath.Lerp(1.2f, 0.8f, PlayerStats.N(defender.Stats.Technique))
                   * FMath.Lerp(0.8f, 1.2f, PlayerStats.N(carrier.Stats.Physical));
        }

        public static float InterceptRadius(SimPlayer p)
        {
            return 0.35f + 0.3f * PlayerStats.N(p.Stats.Reaction) + 0.15f * p.EffectiveDefense + (p.IsGoalkeeper ? 0.3f : 0f);
        }

        public static float InterceptChance(SimPlayer p, float ballSpeed, float skillScale)
        {
            float reaction = PlayerStats.N(p.Stats.Reaction);
            return FMath.Clamp(0.2f + 0.3f * reaction * skillScale - (ballSpeed - 10f) * 0.04f, 0.05f, 0.6f);
        }

        public static float BlockRadius(SimPlayer d)
        {
            return 0.35f + (d.BlockTimer > 0f ? 0.5f : 0.15f) + 0.2f * d.EffectiveDefense;
        }

        public static float BlockChance(SimPlayer d, float skillScale)
        {
            return (d.BlockTimer > 0f ? 0.3f + 0.4f * d.EffectiveDefense : 0.1f) * skillScale;
        }

        public static float CatchRadius(SimPlayer m, bool assisted)
        {
            return 0.6f + 0.3f * PlayerStats.N(m.Stats.Reaction) + (assisted ? 0.3f : 0f);
        }

        public static float FumbleChance(SimPlayer m, float ballSpeed)
        {
            return FMath.Clamp(0.03f + (ballSpeed - 11f) * 0.02f - PlayerStats.N(m.Stats.Technique) * 0.05f, 0f, 0.3f);
        }

        public static float PickupRadius(SimPlayer p) => 0.55f + 0.25f * PlayerStats.N(p.Stats.Reaction);
    }
}
