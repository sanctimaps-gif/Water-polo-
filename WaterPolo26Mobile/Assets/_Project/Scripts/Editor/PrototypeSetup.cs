using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using WaterPolo.Runtime;
using WaterPolo.Simulation;

namespace WaterPolo.EditorTools
{
    /// <summary>Editor menu: one click to get a playable prototype scene, plus a headless AI benchmark.</summary>
    public static class PrototypeSetup
    {
        private const string ScenePath = "Assets/_Project/Scenes/Prototype.unity";
        private const string MaterialFolder = "Assets/_Project/Resources/Materials";
        private const string BaseMaterialPath = MaterialFolder + "/WP26_Base.mat";

        [MenuItem("Water Polo 26/Create Prototype Scene")]
        public static void CreatePrototypeScene()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;

            CreateBaseMaterial();
            ConfigurePlayerSettings();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("GameBootstrap").AddComponent<GameBootstrap>();
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            EditorSceneManager.SaveScene(scene, ScenePath);

            var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            scenes.RemoveAll(s => s.path == ScenePath);
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();

            Debug.Log($"[WP26] Prototype scene created at {ScenePath}. Press Play.");
        }

        /// <summary>Saves the base material so its shader is included in device builds.</summary>
        private static void CreateBaseMaterial()
        {
            if (AssetDatabase.LoadAssetAtPath<Material>(BaseMaterialPath) != null) return;
            Directory.CreateDirectory(MaterialFolder);
            bool srp = GraphicsSettings.currentRenderPipeline != null;
            Shader shader = Shader.Find(srp ? "Universal Render Pipeline/Lit" : "Standard");
            if (shader == null) shader = Shader.Find("Standard");
            AssetDatabase.CreateAsset(new Material(shader), BaseMaterialPath);
            AssetDatabase.SaveAssets();
        }

        private static void ConfigurePlayerSettings()
        {
            PlayerSettings.productName = "Water Polo 26 Mobile";
            // Menus can rotate; the match forces landscape at runtime (Orientation.EnterLandscape).
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
        }

        [MenuItem("Water Polo 26/Run AI Benchmark (10 matches)")]
        public static void RunBenchmark()
        {
            int goals = 0, shots = 0, passes = 0, completed = 0;
            var watch = System.Diagnostics.Stopwatch.StartNew();
            for (int seed = 1; seed <= 10; seed++)
            {
                var sim = new MatchSimulation(new MatchConfig { Seed = seed, HumanTeam = -1 }, DemoTeams.Home(), DemoTeams.Away());
                sim.StartMatch();
                while (!sim.IsFinished) sim.Step();
                foreach (var t in sim.Stats.Teams)
                {
                    goals += t.Goals; shots += t.Shots; passes += t.Passes; completed += t.PassesCompleted;
                }
                Debug.Log($"[WP26] seed {seed}: {sim.Teams[0].Score}-{sim.Teams[1].Score}");
            }
            Debug.Log($"[WP26] 10 matches in {watch.ElapsedMilliseconds} ms | goals/match {goals / 10f:0.0} | " +
                      $"conversion {(shots > 0 ? goals / (float)shots : 0f):0.00} | pass accuracy {(passes > 0 ? completed / (float)passes : 0f):0.00}");
        }
    }
}
