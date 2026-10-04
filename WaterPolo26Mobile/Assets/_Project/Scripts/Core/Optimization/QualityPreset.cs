namespace WaterPolo.Core.Optimization
{
    public enum WaterQuality
    {
        /// <summary>Flat vertex-coloured surface, scrolling normal only.</summary>
        Simple = 0,
        /// <summary>Animated normals + fake reflection (cubemap).</summary>
        Standard = 1,
        /// <summary>Gerstner waves + planar-ish reflection at low resolution.</summary>
        High = 2,
        /// <summary>High + refraction + foam.</summary>
        Ultra = 3,
    }

    /// <summary>
    /// Every graphics budget the game adapts per tier. Systems read their budget
    /// from here instead of hard-coding numbers (crowd, particles, water...).
    /// </summary>
    public sealed class QualityPreset
    {
        public DeviceTier Tier;
        public int TargetFrameRate;
        /// <summary>3D render scale (UI is always rendered at native resolution).</summary>
        public float RenderScale;
        public WaterQuality Water;
        public bool Shadows;
        public float ShadowDistance;
        public int MsaaSamples;
        public int MaxParticles;
        /// <summary>Animated 3D spectators; the rest of the crowd uses impostor cards.</summary>
        public int CrowdAnimated3D;
        public int CrowdImpostors;
        /// <summary>0 = full res textures, 1 = half, 2 = quarter.</summary>
        public int TextureMipLimit;
        public float LodBias;
        public float DrawDistance;
        public bool PostProcessing;
        /// <summary>Distance (m) beyond which player animations update at reduced rate.</summary>
        public float AnimationLodDistance;

        public static QualityPreset For(DeviceTier tier)
        {
            switch (tier)
            {
                case DeviceTier.Low:
                    return new QualityPreset
                    {
                        Tier = tier, TargetFrameRate = 30, RenderScale = 0.7f, Water = WaterQuality.Simple,
                        Shadows = false, ShadowDistance = 0f, MsaaSamples = 0, MaxParticles = 64,
                        CrowdAnimated3D = 0, CrowdImpostors = 150, TextureMipLimit = 1, LodBias = 0.6f,
                        DrawDistance = 60f, PostProcessing = false, AnimationLodDistance = 10f,
                    };
                case DeviceTier.Medium:
                    return new QualityPreset
                    {
                        Tier = tier, TargetFrameRate = 30, RenderScale = 0.85f, Water = WaterQuality.Standard,
                        Shadows = true, ShadowDistance = 25f, MsaaSamples = 0, MaxParticles = 160,
                        CrowdAnimated3D = 40, CrowdImpostors = 400, TextureMipLimit = 1, LodBias = 0.8f,
                        DrawDistance = 90f, PostProcessing = false, AnimationLodDistance = 18f,
                    };
                case DeviceTier.High:
                    return new QualityPreset
                    {
                        Tier = tier, TargetFrameRate = 60, RenderScale = 0.9f, Water = WaterQuality.High,
                        Shadows = true, ShadowDistance = 40f, MsaaSamples = 2, MaxParticles = 400,
                        CrowdAnimated3D = 120, CrowdImpostors = 900, TextureMipLimit = 0, LodBias = 1f,
                        DrawDistance = 120f, PostProcessing = true, AnimationLodDistance = 28f,
                    };
                default:
                    return new QualityPreset
                    {
                        Tier = DeviceTier.Ultra, TargetFrameRate = 60, RenderScale = 1f, Water = WaterQuality.Ultra,
                        Shadows = true, ShadowDistance = 55f, MsaaSamples = 4, MaxParticles = 800,
                        CrowdAnimated3D = 250, CrowdImpostors = 1500, TextureMipLimit = 0, LodBias = 1.3f,
                        DrawDistance = 160f, PostProcessing = true, AnimationLodDistance = 40f,
                    };
            }
        }
    }
}
