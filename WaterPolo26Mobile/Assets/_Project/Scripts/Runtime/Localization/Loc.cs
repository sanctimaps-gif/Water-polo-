using UnityEngine;
using WaterPolo.Core.Localization;

namespace WaterPolo.Runtime
{
    /// <summary>
    /// Runtime access to the string tables in Resources/Localization/{lang}.txt.
    /// English is always loaded as fallback.
    /// </summary>
    public static class Loc
    {
        private static LocalizationTable _table;

        public static string Language => Table.Language;

        public static LocalizationTable Table
        {
            get
            {
                if (_table == null) SetLanguage(LocalizationTable.CodeFromSystemLanguage(Application.systemLanguage.ToString()));
                return _table;
            }
        }

        public static void SetLanguage(string code)
        {
            LocalizationTable english = Load("en");
            LocalizationTable table = code == "en" ? english : Load(code);
            if (table.Count == 0) table = english;
            table.SetFallback(english);
            _table = table;
        }

        public static string Get(string key) => Table.Get(key);
        public static string Format(string key, params object[] args) => Table.Format(key, args);

        private static LocalizationTable Load(string code)
        {
            var asset = Resources.Load<TextAsset>("Localization/" + code);
            return LocalizationTable.Parse(code, asset != null ? asset.text : string.Empty);
        }
    }
}
