using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Creates simple coloured materials for the prototype, working with URP or the
    /// built-in pipeline. A base material saved in Resources (by the editor setup menu)
    /// guarantees the shader is included in device builds.
    /// </summary>
    public static class MaterialFactory
    {
        private static Material _base;
        private static readonly Dictionary<int, Material> Cache = new Dictionary<int, Material>();

        public static Material Get(Color color, float smoothness = 0.3f)
        {
            int key = color.GetHashCode() ^ smoothness.GetHashCode();
            if (Cache.TryGetValue(key, out var m) && m != null) return m;

            m = new Material(Base) { color = color };
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", color);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smoothness);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smoothness);
            Cache[key] = m;
            return m;
        }

        public static Color Hex(int rgb) => new Color(((rgb >> 16) & 0xFF) / 255f, ((rgb >> 8) & 0xFF) / 255f, (rgb & 0xFF) / 255f);

        private static Material Base
        {
            get
            {
                if (_base != null) return _base;
                _base = Resources.Load<Material>("Materials/WP26_Base");
                if (_base == null)
                {
                    bool srp = GraphicsSettings.currentRenderPipeline != null;
                    Shader shader = srp ? Shader.Find("Universal Render Pipeline/Lit") : Shader.Find("Standard");
                    if (shader == null) shader = Shader.Find("Universal Render Pipeline/Simple Lit");
                    if (shader == null) shader = Shader.Find("Mobile/Diffuse");
                    if (shader == null) shader = Shader.Find("Diffuse");
                    _base = new Material(shader);
                }
                return _base;
            }
        }
    }
}
