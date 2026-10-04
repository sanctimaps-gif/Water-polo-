namespace WaterPolo.Core
{
    /// <summary>
    /// Seeded xorshift32 generator. The match simulation only uses this generator
    /// (never System.Random or UnityEngine.Random) so a given seed + input stream
    /// always replays the same match: required for replays, tests and, later,
    /// server-side validation of online matches.
    /// </summary>
    public sealed class DeterministicRandom
    {
        private uint _state;

        public DeterministicRandom(int seed)
        {
            _state = (uint)seed;
            if (_state == 0) _state = 0x9E3779B9u;
            // Warm up so close seeds diverge quickly.
            for (int i = 0; i < 8; i++) NextUInt();
        }

        public uint NextUInt()
        {
            uint x = _state;
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            _state = x;
            return x;
        }

        /// <summary>Uniform float in [0, 1).</summary>
        public float NextFloat() => (NextUInt() >> 8) * (1f / 16777216f);

        public float Range(float min, float max) => min + (max - min) * NextFloat();

        public int Range(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            return minInclusive + (int)(NextUInt() % (uint)(maxExclusive - minInclusive));
        }

        public bool Chance(float probability) => NextFloat() < probability;

        /// <summary>Cheap bell-shaped value in roughly [-1, 1] (mean 0).</summary>
        public float Bell() => (NextFloat() + NextFloat() + NextFloat()) * (2f / 3f) - 1f;
    }
}
