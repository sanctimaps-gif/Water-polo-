using UnityEngine;
using WaterPolo.Simulation;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// PROTOTYPE environment built from primitives: water, deck, lane ropes with the
    /// 2 m / 5 m / 6 m colour code, goals with nets, simple stands, lights.
    /// Final art (Phase 4) replaces this with authored meshes and the water shader.
    /// </summary>
    public static class PoolBuilder
    {
        public static readonly Color WaterColor = new Color(0.05f, 0.42f, 0.62f);
        private static readonly Color DeckColor = new Color(0.82f, 0.84f, 0.86f);
        private static readonly Color StandColor = new Color(0.16f, 0.2f, 0.28f);

        public static Transform Build(MatchConfig cfg)
        {
            var root = new GameObject("Pool").transform;
            float hl = cfg.HalfLength, hw = cfg.HalfWidth;
            const float waterMarginX = 2f, waterMarginZ = 1f, deck = 4f;

            // Water (opaque on purpose: cheap on mobile, players' bodies are under the surface anyway).
            var water = Box(root, "Water", new Vector3(0f, -0.05f, 0f),
                new Vector3(cfg.PoolLength + waterMarginX * 2f, 0.1f, cfg.PoolWidth + waterMarginZ * 2f), WaterColor, 0.9f);
            water.AddComponent<WaterSurface>();

            // Deck around the basin.
            float outerX = hl + waterMarginX, outerZ = hw + waterMarginZ;
            Box(root, "DeckNear", new Vector3(0f, 0.1f, -outerZ - deck * 0.5f), new Vector3(outerX * 2f + deck * 2f, 0.4f, deck), DeckColor);
            Box(root, "DeckFar", new Vector3(0f, 0.1f, outerZ + deck * 0.5f), new Vector3(outerX * 2f + deck * 2f, 0.4f, deck), DeckColor);
            Box(root, "DeckLeft", new Vector3(-outerX - deck * 0.5f, 0.1f, 0f), new Vector3(deck, 0.4f, outerZ * 2f), DeckColor);
            Box(root, "DeckRight", new Vector3(outerX + deck * 0.5f, 0.1f, 0f), new Vector3(deck, 0.4f, outerZ * 2f), DeckColor);

            // Lane ropes on both side lines, coloured from each goal line: red 0–2 m, yellow 2–5 m, green 5–6 m, white beyond.
            foreach (float z in new[] { -hw, hw })
            {
                for (int side = -1; side <= 1; side += 2)
                {
                    float goalX = side * hl;
                    Rope(root, z, goalX, goalX - side * 2f, new Color(0.85f, 0.1f, 0.1f));
                    Rope(root, z, goalX - side * 2f, goalX - side * 5f, new Color(0.95f, 0.8f, 0.1f));
                    Rope(root, z, goalX - side * 5f, goalX - side * 6f, new Color(0.1f, 0.7f, 0.25f));
                    Rope(root, z, goalX - side * 6f, 0f, Color.white);
                }
            }

            BuildGoal(root, cfg, -1f);
            BuildGoal(root, cfg, 1f);

            // Stands on the far side (spectators: NON IMPLÉMENTÉ, Phase 4 crowd system).
            for (int row = 0; row < 4; row++)
            {
                Box(root, "Stand" + row, new Vector3(0f, 0.6f + row * 0.7f, outerZ + deck + 1f + row * 1.2f),
                    new Vector3(cfg.PoolLength + 8f, 0.7f, 1.2f), Color.Lerp(StandColor, Color.black, row * 0.1f));
            }

            var lightGo = new GameObject("Key Light");
            lightGo.transform.SetParent(root, false);
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.1f;
            light.shadows = LightShadows.Hard;
            lightGo.transform.rotation = Quaternion.Euler(55f, -30f, 0f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.6f, 0.68f);

            return root;
        }

        private static void BuildGoal(Transform root, MatchConfig cfg, float side)
        {
            var goal = new GameObject(side > 0 ? "Goal +X" : "Goal -X").transform;
            goal.SetParent(root, false);
            float x = side * cfg.HalfLength;
            float hw = cfg.GoalWidth * 0.5f;
            float h = cfg.GoalHeight;
            float depth = cfg.GoalDepth + 0.3f;
            const float r = 0.05f;
            var white = Color.white;

            // Posts start a bit under the surface, crossbar on top.
            Cylinder(goal, "PostL", new Vector3(x, h * 0.5f - 0.15f, -hw), new Vector3(r * 2f, (h + 0.3f) * 0.5f, r * 2f), Quaternion.identity, white);
            Cylinder(goal, "PostR", new Vector3(x, h * 0.5f - 0.15f, hw), new Vector3(r * 2f, (h + 0.3f) * 0.5f, r * 2f), Quaternion.identity, white);
            Cylinder(goal, "Bar", new Vector3(x, h, 0f), new Vector3(r * 2f, hw, r * 2f), Quaternion.Euler(90f, 0f, 0f), white);

            // Net: a few thin bars, opaque and cheap.
            var net = new Color(0.92f, 0.92f, 0.92f);
            float back = x + side * depth;
            Box(goal, "NetTop", new Vector3(x + side * depth * 0.5f, h, 0f), new Vector3(depth, 0.01f, hw * 2f), net);
            for (int i = 0; i <= 6; i++)
            {
                float z = -hw + i * (hw * 2f / 6f);
                Box(goal, "NetV" + i, new Vector3(back, h * 0.5f, z), new Vector3(0.02f, h, 0.02f), net);
            }
            for (int i = 1; i <= 3; i++)
                Box(goal, "NetH" + i, new Vector3(back, h * i / 4f, 0f), new Vector3(0.02f, 0.02f, hw * 2f), net);
            Box(goal, "NetSideL", new Vector3(x + side * depth * 0.5f, h * 0.5f, -hw), new Vector3(depth, h, 0.01f), net);
            Box(goal, "NetSideR", new Vector3(x + side * depth * 0.5f, h * 0.5f, hw), new Vector3(depth, h, 0.01f), net);
        }

        private static void Rope(Transform root, float z, float x0, float x1, Color c)
        {
            float len = Mathf.Abs(x1 - x0);
            if (len < 0.01f) return;
            Cylinder(root, "Rope", new Vector3((x0 + x1) * 0.5f, 0.03f, z), new Vector3(0.12f, len * 0.5f, 0.12f), Quaternion.Euler(0f, 0f, 90f), c);
        }

        public static GameObject Box(Transform parent, string name, Vector3 pos, Vector3 size, Color c, float smoothness = 0.2f)
        {
            return Primitive(PrimitiveType.Cube, parent, name, pos, size, Quaternion.identity, c, smoothness);
        }

        public static GameObject Cylinder(Transform parent, string name, Vector3 pos, Vector3 scale, Quaternion rot, Color c)
        {
            return Primitive(PrimitiveType.Cylinder, parent, name, pos, scale, rot, c, 0.4f);
        }

        public static GameObject Primitive(PrimitiveType type, Transform parent, string name, Vector3 localPos, Vector3 scale,
            Quaternion rot, Color c, float smoothness = 0.3f)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            // Gameplay never uses Unity physics: remove colliders to save CPU.
            var col = go.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = rot;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = MaterialFactory.Get(c, smoothness);
            return go;
        }
    }

    /// <summary>PROTOTYPE water animation: subtle colour shimmer. The real water shader is Phase 4.</summary>
    public sealed class WaterSurface : MonoBehaviour
    {
        private Renderer _renderer;
        private MaterialPropertyBlock _block;

        private void Awake()
        {
            _renderer = GetComponent<Renderer>();
            _block = new MaterialPropertyBlock();
        }

        private void Update()
        {
            float t = Mathf.Sin(Time.time * 0.8f) * 0.5f + 0.5f;
            Color c = Color.Lerp(PoolBuilder.WaterColor, PoolBuilder.WaterColor * 1.12f, t);
            _block.SetColor("_BaseColor", c);
            _block.SetColor("_Color", c);
            _renderer.SetPropertyBlock(_block);
        }
    }
}
