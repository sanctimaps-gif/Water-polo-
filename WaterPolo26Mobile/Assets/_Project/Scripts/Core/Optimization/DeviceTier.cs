using System;

namespace WaterPolo.Core.Optimization
{
    public enum DeviceTier
    {
        Low = 0,
        Medium = 1,
        High = 2,
        Ultra = 3,
    }

    /// <summary>What the player picked in the settings. Auto = detected tier.</summary>
    public enum QualitySetting
    {
        Auto = -1,
        Low = 0,
        Medium = 1,
        High = 2,
        Ultra = 3,
    }

    /// <summary>Hardware facts read from the device (filled by the Unity layer from SystemInfo).</summary>
    public struct DeviceInfo
    {
        public int SystemMemoryMB;
        public int GraphicsMemoryMB;
        public int ProcessorCount;
        public int ProcessorFrequencyMHz;
        /// <summary>Shader model * 10 (e.g. 45 = SM 4.5, 50 = SM 5.0).</summary>
        public int GraphicsShaderLevel;
        public bool SupportsComputeShaders;
        public int ScreenPixelCount;
    }

    /// <summary>
    /// Classifies a device into LOW / MEDIUM / HIGH / ULTRA using a points system.
    /// Pure logic so it can be unit-tested and tuned from field analytics later.
    /// </summary>
    public static class DeviceTierClassifier
    {
        public static DeviceTier Classify(DeviceInfo d)
        {
            int score = 0;

            // RAM is the strongest predictor of mobile performance class.
            if (d.SystemMemoryMB >= 7500) score += 4;
            else if (d.SystemMemoryMB >= 5500) score += 3;
            else if (d.SystemMemoryMB >= 3500) score += 2;
            else if (d.SystemMemoryMB >= 2500) score += 1;

            if (d.ProcessorCount >= 8) score += 2;
            else if (d.ProcessorCount >= 6) score += 1;

            if (d.ProcessorFrequencyMHz >= 2800) score += 1;

            if (d.GraphicsShaderLevel >= 50) score += 1;
            if (d.SupportsComputeShaders) score += 1;

            if (d.GraphicsMemoryMB >= 2048) score += 1;

            DeviceTier tier;
            if (score >= 9) tier = DeviceTier.Ultra;
            else if (score >= 6) tier = DeviceTier.High;
            else if (score >= 3) tier = DeviceTier.Medium;
            else tier = DeviceTier.Low;

            // Hard caps: very little RAM can never be above MEDIUM.
            if (d.SystemMemoryMB > 0 && d.SystemMemoryMB < 3000 && tier > DeviceTier.Medium)
                tier = DeviceTier.Medium;

            return tier;
        }

        public static DeviceTier Resolve(QualitySetting setting, DeviceTier detected)
        {
            return setting == QualitySetting.Auto ? detected : (DeviceTier)Math.Max(0, (int)setting);
        }
    }
}
