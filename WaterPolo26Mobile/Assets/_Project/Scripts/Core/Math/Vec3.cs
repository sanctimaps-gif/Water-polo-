using System;

namespace WaterPolo.Core
{
    /// <summary>
    /// Engine-independent 3D vector used by the simulation.
    /// Convention (identical to Unity): Y is up, the water surface is Y = 0,
    /// the pool length runs along X (goals at ±X), the width along Z.
    /// </summary>
    [Serializable]
    public struct Vec3 : IEquatable<Vec3>
    {
        public float X;
        public float Y;
        public float Z;

        public Vec3(float x, float y, float z)
        {
            X = x;
            Y = y;
            Z = z;
        }

        public static readonly Vec3 Zero = new Vec3(0f, 0f, 0f);
        public static readonly Vec3 Up = new Vec3(0f, 1f, 0f);
        public static readonly Vec3 Right = new Vec3(1f, 0f, 0f);
        public static readonly Vec3 Forward = new Vec3(0f, 0f, 1f);

        public float SqrMagnitude => X * X + Y * Y + Z * Z;
        public float Magnitude => MathF.Sqrt(SqrMagnitude);

        /// <summary>Same vector projected on the water plane (Y = 0).</summary>
        public Vec3 Flat => new Vec3(X, 0f, Z);

        public Vec3 Normalized
        {
            get
            {
                float m = Magnitude;
                return m > 1e-6f ? new Vec3(X / m, Y / m, Z / m) : Zero;
            }
        }

        public static Vec3 operator +(Vec3 a, Vec3 b) => new Vec3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
        public static Vec3 operator -(Vec3 a, Vec3 b) => new Vec3(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
        public static Vec3 operator -(Vec3 a) => new Vec3(-a.X, -a.Y, -a.Z);
        public static Vec3 operator *(Vec3 a, float s) => new Vec3(a.X * s, a.Y * s, a.Z * s);
        public static Vec3 operator *(float s, Vec3 a) => new Vec3(a.X * s, a.Y * s, a.Z * s);
        public static Vec3 operator /(Vec3 a, float s) => new Vec3(a.X / s, a.Y / s, a.Z / s);

        public static float Dot(Vec3 a, Vec3 b) => a.X * b.X + a.Y * b.Y + a.Z * b.Z;
        public static float Distance(Vec3 a, Vec3 b) => (a - b).Magnitude;
        public static float FlatDistance(Vec3 a, Vec3 b) => (a - b).Flat.Magnitude;

        public static Vec3 Lerp(Vec3 a, Vec3 b, float t)
        {
            t = FMath.Clamp01(t);
            return new Vec3(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t);
        }

        public static Vec3 ClampMagnitude(Vec3 v, float max)
        {
            float sq = v.SqrMagnitude;
            if (sq <= max * max) return v;
            return v * (max / MathF.Sqrt(sq));
        }

        public static Vec3 MoveTowards(Vec3 current, Vec3 target, float maxDelta)
        {
            Vec3 d = target - current;
            float dist = d.Magnitude;
            if (dist <= maxDelta || dist < 1e-6f) return target;
            return current + d / dist * maxDelta;
        }

        /// <summary>Rotates a flat direction toward another flat direction by at most maxRadians.</summary>
        public static Vec3 RotateFlatTowards(Vec3 from, Vec3 to, float maxRadians)
        {
            float a = MathF.Atan2(from.Z, from.X);
            float b = MathF.Atan2(to.Z, to.X);
            float delta = FMath.WrapAngle(b - a);
            float step = FMath.Clamp(delta, -maxRadians, maxRadians);
            float r = a + step;
            return new Vec3(MathF.Cos(r), 0f, MathF.Sin(r));
        }

        /// <summary>Distance from point p to the segment [a, b], measured on the water plane.</summary>
        public static float FlatDistanceToSegment(Vec3 p, Vec3 a, Vec3 b, out float t)
        {
            Vec3 ab = (b - a).Flat;
            Vec3 ap = (p - a).Flat;
            float len2 = ab.SqrMagnitude;
            t = len2 > 1e-6f ? FMath.Clamp01(Dot(ap, ab) / len2) : 0f;
            Vec3 closest = a.Flat + ab * t;
            return (p.Flat - closest).Magnitude;
        }

        public bool Equals(Vec3 other) => X == other.X && Y == other.Y && Z == other.Z;
        public override bool Equals(object obj) => obj is Vec3 v && Equals(v);
        public override int GetHashCode() => HashCode.Combine(X, Y, Z);
        public override string ToString() => $"({X:0.00}, {Y:0.00}, {Z:0.00})";
    }
}
