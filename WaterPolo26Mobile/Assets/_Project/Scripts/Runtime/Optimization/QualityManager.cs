using UnityEngine;
using WaterPolo.Core.Optimization;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Detects the device tier, applies the matching QualityPreset and, in AUTO mode,
    /// lowers the tier when frames stay over budget (thermal / battery protection).
    /// Other systems read <see cref="Current"/> for their budgets.
    /// </summary>
    public sealed class QualityManager : MonoBehaviour
    {
        private const string PrefKey = "wp26.quality";

        public static QualityManager Instance { get; private set; }
        public static event System.Action<QualityPreset> PresetChanged;

        public DeviceTier DetectedTier { get; private set; }
        public QualitySetting Setting { get; private set; } = QualitySetting.Auto;
        public QualityPreset Current { get; private set; }

        private readonly FrameTimeGovernor _governor = new FrameTimeGovernor();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            DetectedTier = DeviceTierClassifier.Classify(ReadDevice());
            Setting = (QualitySetting)PlayerPrefs.GetInt(PrefKey, (int)QualitySetting.Auto);
            Apply(DeviceTierClassifier.Resolve(Setting, DetectedTier));
        }

        public static DeviceInfo ReadDevice()
        {
            return new DeviceInfo
            {
                SystemMemoryMB = SystemInfo.systemMemorySize,
                GraphicsMemoryMB = SystemInfo.graphicsMemorySize,
                ProcessorCount = SystemInfo.processorCount,
                ProcessorFrequencyMHz = SystemInfo.processorFrequency,
                GraphicsShaderLevel = SystemInfo.graphicsShaderLevel,
                SupportsComputeShaders = SystemInfo.supportsComputeShaders,
                ScreenPixelCount = Screen.width * Screen.height,
            };
        }

        public void SetSetting(QualitySetting setting)
        {
            Setting = setting;
            PlayerPrefs.SetInt(PrefKey, (int)setting);
            Apply(DeviceTierClassifier.Resolve(setting, DetectedTier));
        }

        private void Update()
        {
            if (Setting != QualitySetting.Auto || Current == null) return;
            var rec = _governor.Sample(Time.unscaledDeltaTime, Current.TargetFrameRate, false);
            if (rec == FrameTimeGovernor.Recommendation.Downgrade && Current.Tier > DeviceTier.Low)
                Apply(Current.Tier - 1);
            else if (rec == FrameTimeGovernor.Recommendation.Upgrade && Current.Tier < DetectedTier)
                Apply(Current.Tier + 1);
        }

        private void Apply(DeviceTier tier)
        {
            Current = QualityPreset.For(tier);
            Application.targetFrameRate = Current.TargetFrameRate;
            QualitySettings.vSyncCount = 0;
            QualitySettings.shadows = Current.Shadows ? ShadowQuality.HardOnly : ShadowQuality.Disable;
            QualitySettings.shadowDistance = Current.ShadowDistance;
            QualitySettings.antiAliasing = Current.MsaaSamples;
            QualitySettings.lodBias = Current.LodBias;
#if UNITY_2022_2_OR_NEWER
            QualitySettings.globalTextureMipmapLimit = Current.TextureMipLimit;
#else
            QualitySettings.masterTextureLimit = Current.TextureMipLimit;
#endif
            // NON IMPLÉMENTÉ (Phase 3): RenderScale, water quality, crowd and particle budgets are
            // computed per tier but not consumed yet (no URP asset, no crowd/particles in the prototype).
            PresetChanged?.Invoke(Current);
        }
    }
}
