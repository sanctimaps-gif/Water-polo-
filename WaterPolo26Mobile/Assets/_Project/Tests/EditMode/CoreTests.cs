using System;
using System.IO;
using NUnit.Framework;
using WaterPolo.Core;
using WaterPolo.Core.Localization;
using WaterPolo.Core.Optimization;

namespace WaterPolo.Tests
{
    public class CoreTests
    {
        [Test]
        public void Vec3_BasicOperations()
        {
            var a = new Vec3(3f, 4f, 0f);
            Assert.AreEqual(5f, a.Magnitude, 1e-5f);
            Assert.AreEqual(1f, a.Normalized.Magnitude, 1e-5f);
            Assert.AreEqual(Vec3.Zero, Vec3.Zero.Normalized);
            Assert.AreEqual(3f, Vec3.ClampMagnitude(a, 3f).Magnitude, 1e-5f);
            Assert.AreEqual(new Vec3(1f, 0f, 0f), Vec3.MoveTowards(Vec3.Zero, new Vec3(10f, 0f, 0f), 1f));
        }

        [Test]
        public void Vec3_RotateFlatTowards_IsRateLimited()
        {
            var from = new Vec3(1f, 0f, 0f);
            var to = new Vec3(0f, 0f, 1f);
            var r = Vec3.RotateFlatTowards(from, to, 10f * FMath.Deg2Rad);
            float angle = MathF.Acos(Vec3.Dot(from, r)) / FMath.Deg2Rad;
            Assert.AreEqual(10f, angle, 0.01f);
            Assert.Greater(r.Z, 0f, "rotates toward the target side");
        }

        [Test]
        public void Vec3_DistanceToSegment()
        {
            float d = Vec3.FlatDistanceToSegment(new Vec3(5f, 0f, 2f), Vec3.Zero, new Vec3(10f, 0f, 0f), out float t);
            Assert.AreEqual(2f, d, 1e-5f);
            Assert.AreEqual(0.5f, t, 1e-5f);
        }

        [Test]
        public void DeterministicRandom_SameSeedSameSequence()
        {
            var a = new DeterministicRandom(42);
            var b = new DeterministicRandom(42);
            var c = new DeterministicRandom(43);
            bool differs = false;
            for (int i = 0; i < 100; i++)
            {
                float x = a.NextFloat();
                Assert.AreEqual(x, b.NextFloat());
                if (x != c.NextFloat()) differs = true;
                Assert.That(x, Is.InRange(0f, 1f));
            }
            Assert.IsTrue(differs);
        }

        [Test]
        public void DeterministicRandom_BellIsCenteredAndBounded()
        {
            var r = new DeterministicRandom(7);
            double sum = 0;
            for (int i = 0; i < 10000; i++)
            {
                float v = r.Bell();
                Assert.That(v, Is.InRange(-1f, 1f));
                sum += v;
            }
            Assert.AreEqual(0.0, sum / 10000, 0.03);
        }

        // ------------------------------------------------------------------ device tiers

        [Test]
        public void DeviceTier_ClassifiesTypicalDevices()
        {
            var oldPhone = new DeviceInfo { SystemMemoryMB = 2048, ProcessorCount = 4, ProcessorFrequencyMHz = 1400, GraphicsShaderLevel = 35 };
            var midPhone = new DeviceInfo { SystemMemoryMB = 4096, ProcessorCount = 8, ProcessorFrequencyMHz = 2000, GraphicsShaderLevel = 45 };
            var recentPhone = new DeviceInfo { SystemMemoryMB = 6144, ProcessorCount = 8, ProcessorFrequencyMHz = 2600, GraphicsShaderLevel = 50, SupportsComputeShaders = true };
            var flagship = new DeviceInfo { SystemMemoryMB = 12288, ProcessorCount = 8, ProcessorFrequencyMHz = 3200, GraphicsShaderLevel = 50, SupportsComputeShaders = true, GraphicsMemoryMB = 4096 };

            Assert.AreEqual(DeviceTier.Low, DeviceTierClassifier.Classify(oldPhone));
            Assert.AreEqual(DeviceTier.Medium, DeviceTierClassifier.Classify(midPhone));
            Assert.AreEqual(DeviceTier.High, DeviceTierClassifier.Classify(recentPhone));
            Assert.AreEqual(DeviceTier.Ultra, DeviceTierClassifier.Classify(flagship));
        }

        [Test]
        public void DeviceTier_LowRamIsCappedAtMedium()
        {
            var weird = new DeviceInfo { SystemMemoryMB = 2900, ProcessorCount = 8, ProcessorFrequencyMHz = 3000, GraphicsShaderLevel = 50, SupportsComputeShaders = true, GraphicsMemoryMB = 4096 };
            Assert.LessOrEqual(DeviceTierClassifier.Classify(weird), DeviceTier.Medium);
        }

        [Test]
        public void DeviceTier_ManualSettingOverridesDetection()
        {
            Assert.AreEqual(DeviceTier.High, DeviceTierClassifier.Resolve(QualitySetting.Auto, DeviceTier.High));
            Assert.AreEqual(DeviceTier.Low, DeviceTierClassifier.Resolve(QualitySetting.Low, DeviceTier.Ultra));
        }

        [Test]
        public void QualityPresets_BudgetsGrowWithTier()
        {
            QualityPreset prev = null;
            foreach (DeviceTier tier in Enum.GetValues(typeof(DeviceTier)))
            {
                var q = QualityPreset.For(tier);
                Assert.AreEqual(tier, q.Tier);
                if (prev != null)
                {
                    Assert.GreaterOrEqual(q.RenderScale, prev.RenderScale);
                    Assert.GreaterOrEqual(q.MaxParticles, prev.MaxParticles);
                    Assert.GreaterOrEqual(q.CrowdAnimated3D + q.CrowdImpostors, prev.CrowdAnimated3D + prev.CrowdImpostors);
                    Assert.GreaterOrEqual((int)q.Water, (int)prev.Water);
                    Assert.GreaterOrEqual(q.DrawDistance, prev.DrawDistance);
                }
                prev = q;
            }
        }

        [Test]
        public void FrameTimeGovernor_DowngradesOnSustainedSlowFrames()
        {
            var g = new FrameTimeGovernor(downgradeAfterSeconds: 2f);
            var rec = FrameTimeGovernor.Recommendation.Keep;
            for (int i = 0; i < 200 && rec == FrameTimeGovernor.Recommendation.Keep; i++)
                rec = g.Sample(1f / 20f, 30, false); // 20 fps for a 30 fps target
            Assert.AreEqual(FrameTimeGovernor.Recommendation.Downgrade, rec);
        }

        [Test]
        public void FrameTimeGovernor_ThermalWarningDowngradesFaster()
        {
            int Ticks(bool thermal)
            {
                var g = new FrameTimeGovernor(downgradeAfterSeconds: 2f);
                for (int i = 1; i < 1000; i++)
                    if (g.Sample(1f / 26f, 30, thermal) == FrameTimeGovernor.Recommendation.Downgrade) return i;
                return int.MaxValue;
            }
            Assert.Less(Ticks(true), Ticks(false));
        }

        [Test]
        public void FrameTimeGovernor_UpgradesOnlyAfterLongHeadroom()
        {
            var g = new FrameTimeGovernor(downgradeAfterSeconds: 2f, upgradeAfterSeconds: 10f);
            int upgradeAt = -1;
            for (int i = 1; i < 2000; i++)
            {
                if (g.Sample(1f / 120f, 30, false) == FrameTimeGovernor.Recommendation.Upgrade)
                {
                    upgradeAt = i;
                    break;
                }
            }
            Assert.Greater(upgradeAt, 0);
            Assert.GreaterOrEqual(upgradeAt / 120f, 10f - 0.1f);
        }

        // ------------------------------------------------------------------ localization

        [Test]
        public void Localization_ParseFallbackAndFormat()
        {
            var en = LocalizationTable.Parse("en", "# comment\nhud.goal = GOAL!\nhud.period = Period {0}\nonly.en = English");
            var fr = LocalizationTable.Parse("fr", "hud.goal = BUT !\nhud.period = Période {0}\n");
            fr.SetFallback(en);

            Assert.AreEqual("BUT !", fr.Get("hud.goal"));
            Assert.AreEqual("Période 2", fr.Format("hud.period", 2));
            Assert.AreEqual("English", fr.Get("only.en"));
            Assert.AreEqual("missing.key", fr.Get("missing.key"));
            Assert.AreEqual("fr", LocalizationTable.CodeFromSystemLanguage("French"));
            Assert.AreEqual("en", LocalizationTable.CodeFromSystemLanguage("Klingon"));
        }

        [Test]
        public void Localization_AllLanguageFilesHaveTheSameKeys()
        {
            string dir = FindLocalizationDirectory();
            if (dir == null)
            {
                Assert.Ignore("Localization folder not found from the test working directory.");
                return;
            }

            var reference = LocalizationTable.Parse("fr", File.ReadAllText(Path.Combine(dir, "fr.txt")));
            Assert.Greater(reference.Count, 10);
            foreach (string lang in LocalizationTable.SupportedLanguages)
            {
                string path = Path.Combine(dir, lang + ".txt");
                Assert.IsTrue(File.Exists(path), $"Missing {lang}.txt");
                var table = LocalizationTable.Parse(lang, File.ReadAllText(path));
                foreach (string key in reference.Keys)
                    Assert.IsTrue(table.Contains(key), $"{lang}.txt is missing key '{key}'");
                Assert.AreEqual(reference.Count, table.Count, $"{lang}.txt has extra keys");
            }
        }

        private static string FindLocalizationDirectory()
        {
            string rel = Path.Combine("Assets", "_Project", "Resources", "Localization");
            string dir = TestContext.CurrentContext.TestDirectory;
            for (int i = 0; i < 8 && dir != null; i++)
            {
                foreach (string candidate in new[] { Path.Combine(dir, rel), Path.Combine(dir, "WaterPolo26Mobile", rel) })
                    if (Directory.Exists(candidate)) return candidate;
                dir = Path.GetDirectoryName(dir);
            }
            // Unity runs tests with the project folder as the working directory.
            string cwd = Path.Combine(Directory.GetCurrentDirectory(), rel);
            return Directory.Exists(cwd) ? cwd : null;
        }
    }
}
