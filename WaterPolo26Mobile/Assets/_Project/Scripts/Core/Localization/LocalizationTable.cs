using System;
using System.Collections.Generic;

namespace WaterPolo.Core.Localization
{
    /// <summary>
    /// Key/value string table. Files are plain UTF-8 text:
    /// <code>
    /// # comment
    /// hud.goal = BUT !
    /// hud.period = Période {0}
    /// </code>
    /// Visible text never lives in code: code only references keys.
    /// </summary>
    public sealed class LocalizationTable
    {
        public static readonly string[] SupportedLanguages = { "fr", "en", "es", "de", "it", "pt" };

        private readonly Dictionary<string, string> _entries = new Dictionary<string, string>(StringComparer.Ordinal);
        private LocalizationTable _fallback;

        public string Language { get; }
        public int Count => _entries.Count;

        public LocalizationTable(string language)
        {
            Language = language;
        }

        public static LocalizationTable Parse(string language, string content)
        {
            var table = new LocalizationTable(language);
            if (string.IsNullOrEmpty(content)) return table;

            string[] lines = content.Split('\n');
            foreach (string raw in lines)
            {
                string line = raw.Trim();
                if (line.Length == 0 || line[0] == '#') continue;
                int eq = line.IndexOf('=');
                if (eq <= 0) continue;
                string key = line.Substring(0, eq).Trim();
                string value = line.Substring(eq + 1).Trim().Replace("\\n", "\n");
                table._entries[key] = value;
            }

            return table;
        }

        public void SetFallback(LocalizationTable fallback)
        {
            if (fallback != this) _fallback = fallback;
        }

        public bool Contains(string key) => _entries.ContainsKey(key);

        public IEnumerable<string> Keys => _entries.Keys;

        /// <summary>Returns the translation, the fallback translation, or the key itself (visible bug, never a crash).</summary>
        public string Get(string key)
        {
            if (_entries.TryGetValue(key, out string v)) return v;
            if (_fallback != null && _fallback._entries.TryGetValue(key, out v)) return v;
            return key;
        }

        public string Format(string key, params object[] args)
        {
            string pattern = Get(key);
            try
            {
                return string.Format(pattern, args);
            }
            catch (FormatException)
            {
                return pattern;
            }
        }

        /// <summary>Maps an OS language name (e.g. Unity's SystemLanguage.ToString()) to a supported code, default "en".</summary>
        public static string CodeFromSystemLanguage(string systemLanguage)
        {
            switch (systemLanguage)
            {
                case "French": return "fr";
                case "Spanish": return "es";
                case "German": return "de";
                case "Italian": return "it";
                case "Portuguese": return "pt";
                default: return "en";
            }
        }
    }
}
