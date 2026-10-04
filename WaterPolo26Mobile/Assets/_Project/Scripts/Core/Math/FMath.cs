using System;

namespace WaterPolo.Core
{
    /// <summary>Small float helpers (no dependency on UnityEngine.Mathf).</summary>
    public static class FMath
    {
        public const float Pi = 3.14159265f;
        public const float Deg2Rad = Pi / 180f;

        public static float Clamp(float v, float min, float max) => v < min ? min : (v > max ? max : v);
        public static float Clamp01(float v) => v < 0f ? 0f : (v > 1f ? 1f : v);
        public static float Lerp(float a, float b, float t) => a + (b - a) * Clamp01(t);

        public static float InverseLerp(float a, float b, float v)
        {
            if (MathF.Abs(b - a) < 1e-6f) return 0f;
            return Clamp01((v - a) / (b - a));
        }

        public static float MoveTowards(float current, float target, float maxDelta)
        {
            if (MathF.Abs(target - current) <= maxDelta) return target;
            return current + MathF.Sign(target - current) * maxDelta;
        }

        /// <summary>Wraps an angle in radians to [-PI, PI].</summary>
        public static float WrapAngle(float a)
        {
            while (a > Pi) a -= 2f * Pi;
            while (a < -Pi) a += 2f * Pi;
            return a;
        }

        public static float SmoothStep(float t)
        {
            t = Clamp01(t);
            return t * t * (3f - 2f * t);
        }
    }
}
