using System;

namespace WaterPolo.Simulation
{
    /// <summary>
    /// The 14 attributes of a player, each in [1, 99].
    /// Every attribute is consumed by gameplay code (see docs/GAMEPLAY.md, "Effet des statistiques"):
    ///  Speed        -> max swim speed (SwimmerMotor)
    ///  Acceleration -> how fast velocity reaches the target (SwimmerMotor)
    ///  Stamina      -> sprint drain and recovery (SwimmerMotor)
    ///  Passing      -> pass speed and pass accuracy (PassSystem), GK clearance
    ///  Shooting     -> shot accuracy (ShotSystem) and AI shooting range
    ///  Power        -> shot speed and long pass speed
    ///  Accuracy     -> shot dispersion (ShotSystem)
    ///  Defense      -> steal success, block and interception reach
    ///  Reaction     -> interception reach, GK reaction delay, catch radius
    ///  Positioning  -> AI positional accuracy, GK placement
    ///  Technique    -> turn rate, catch reliability, speed while carrying the ball
    ///  Intelligence -> AI decision frequency and pass target choice quality, GK anticipation
    ///  Physical     -> resistance to steals, foul drawing
    ///  Goalkeeping  -> GK dive reach and save chance
    /// </summary>
    [Serializable]
    public struct PlayerStats
    {
        public int Speed;
        public int Acceleration;
        public int Stamina;
        public int Passing;
        public int Shooting;
        public int Power;
        public int Accuracy;
        public int Defense;
        public int Reaction;
        public int Positioning;
        public int Technique;
        public int Intelligence;
        public int Physical;
        public int Goalkeeping;

        /// <summary>Converts a 1..99 stat to 0..1.</summary>
        public static float N(int stat) => (Math.Max(1, Math.Min(99, stat)) - 1) / 98f;

        public static PlayerStats Uniform(int value)
        {
            return new PlayerStats
            {
                Speed = value, Acceleration = value, Stamina = value, Passing = value, Shooting = value,
                Power = value, Accuracy = value, Defense = value, Reaction = value, Positioning = value,
                Technique = value, Intelligence = value, Physical = value, Goalkeeping = value,
            };
        }

        public int Overall(PlayerRole role)
        {
            if (role == PlayerRole.Goalkeeper)
                return (Goalkeeping * 3 + Reaction * 2 + Positioning * 2 + Passing + Intelligence + Physical) / 10;
            return (Speed + Acceleration + Stamina + Passing + Shooting + Power + Accuracy + Defense +
                    Reaction + Positioning + Technique + Intelligence + Physical) / 13;
        }
    }
}
