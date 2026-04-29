# PH-GYS Aircraft Data

## Aircraft Identification

| Field | Value |
|---|---|
| Registration | PH-GYS |
| Type | Reims/Cessna F172N (Skyhawk) |
| Serial Number | F17201871 |
| Owner | Stichting Vliegmaterieel Schiphol (SVS) |
| Base | EHTE (Vliegveld Hilversum) |
| Engine | Lycoming O-320-D2G, 160 BHP |
| Propeller | McCauley 1C160/DTM7557, fixed pitch |
| Fuel | 100LL Aviation Gasoline |
| Tanks | Long range (2x 102 ltr = 204 ltr total, 189 ltr usable) |

## Weight Data

| Parameter | Value | Source |
|---|---|---|
| Basic Empty Weight | 680.00 kg | Mass and Balance Report, 29-7-2024 |
| Empty CG Arm | 1.02 m | Mass and Balance Report, 29-7-2024 |
| Empty Moment | 696.42 m.kg | Mass and Balance Report, 29-7-2024 |
| MTOW Normal Category | 1089 kg | Flight Manual (corrected) |
| MTOW Utility Category | 952 kg | Flight Manual (corrected) |
| Max Ramp Weight | 1092 kg | Quick Reference Card |
| Useful Load | 409 kg | 1089 - 680 |
| Max Fuel (usable) | 190 ltr / 137 kg | Quick Reference Card |

## Station Arms (from datum = firewall front face)

| Station | Arm (m) | Arm (inches) | Max Weight | Notes |
|---|---|---|---|---|
| Pilot & Front Passenger | 0.94 | 37 | - | Range 0.86-1.17 m |
| Rear Passengers | 1.85 | 73 | - | |
| Fuel | 1.22 | 48 | 137 kg (190 ltr) | Density: 0.72 kg/ltr |
| Baggage Area 1 | 2.41 | 95 | 54 kg | Forward of baggage door latch |
| Baggage Area 2 | 3.12 | 123 | 23 kg | Aft of baggage door latch |

Combined baggage (Area 1 + Area 2): max 54 kg.

Note: the AFM loading graph uses 23 kg for Baggage Area 2. The PH-GYS quick reference card shows 22 kg in one row, while the POH/source data and existing calculator limit use 23 kg. Keep this at 23 kg unless SVS explicitly adopts 22 kg as an operating policy.

## W&B Calculation Sequence

The calculator follows the PH-GYS quick reference card sequence:

1. Basic Empty Weight + occupants + baggage = Zero Fuel Weight.
2. Add usable fuel at 0.72 kg/l to get Ramp Weight.
3. Subtract taxi fuel at the fuel arm to get Takeoff Weight.
4. Subtract trip fuel at the fuel arm to get Landing Weight.
5. Check both Takeoff Weight and Landing Weight against the normal-category CG envelope.

The takeoff-distance page receives the calculated Takeoff Weight after taxi fuel.

## CG Limits

### Normal Category

```
Aft limit:     1.20 m (constant at all weights up to 1089 kg)
Forward limit: 0.89 m at 885 kg or less
               1.00 m at 1089 kg
               Linear interpolation between 885 and 1089 kg
```

### Utility Category

```
Aft limit:     1.03 m (constant at all weights up to 952 kg)
Forward limit: 0.89 m at 885 kg or less
               0.93 m at 952 kg
               Linear interpolation between 885 and 952 kg
```

## CG Moment Envelope Polygon Coordinates

Used for the graphical envelope check (Weight vs Moment):

### Normal Category

| Point | Moment (m.kg) | Weight (kg) | Derivation |
|---|---|---|---|
| 1 (fwd, min) | 605.2 | 680 | 680 x 0.89 |
| 2 (fwd, mid) | 787.65 | 885 | 885 x 0.89 |
| 3 (fwd, max) | 1089.0 | 1089 | 1089 x 1.00 |
| 4 (aft, max) | 1306.8 | 1089 | 1089 x 1.20 |
| 5 (aft, mid) | 1062.0 | 885 | 885 x 1.20 |
| 6 (aft, min) | 816.0 | 680 | 680 x 1.20 |

### Utility Category

| Point | Moment (m.kg) | Weight (kg) | Derivation |
|---|---|---|---|
| 1 (fwd, min) | 605.2 | 680 | 680 x 0.89 |
| 2 (fwd, mid) | 787.65 | 885 | 885 x 0.89 |
| 3 (fwd, max) | 885.36 | 952 | 952 x 0.93 |
| 4 (aft, max) | 980.56 | 952 | 952 x 1.03 |
| 5 (aft, mid) | 911.55 | 885 | 885 x 1.03 |
| 6 (aft, min) | 700.4 | 680 | 680 x 1.03 |

## Takeoff Performance Source Data

The takeoff-distance calculator uses the Cessna F172N AFM Section 5 short-field takeoff tables:

- Weights: 862 kg, 953 kg, 1043 kg.
- Pressure altitude: sea level through 8000 ft in 1000 ft steps.
- OAT: 0, 10, 20, 30, 40 °C.
- Conditions: flaps up, full throttle prior to brake release, paved level dry runway, zero wind.

The source CSV is `docs/soft_field_takeoff_distance.csv`, transcribed from `docs/soft_field_to_862.pdf`, `docs/soft_field_to_953.pdf`, and `docs/soft_field_to_1043.pdf`. The data tests compare every table cell in code against this CSV.

Corrections applied after table lookup:

- Dry grass: add 15% of the ground roll figure to both ground roll and total-over-15m distance, per POH note 4.
- Wet grass: add 45% of the ground roll figure to both distances, per the handwritten PH-GYS POH annotation.
- Headwind: decrease distances 10% for each 9 kt headwind, per POH note 3.
- Tailwind: increase distances 10% for each 2 kt tailwind, valid up to 10 kt tailwind per POH note 3.

EHHV runway elevation, true bearings, and declared TORA/TODA values are taken from AIP EHHV AD 2.12/2.13. These values are tested explicitly in `takeoff-data.test.js`.

## Data Sources

1. **Mass and Balance Report AMN-F19A** (Aircraft Maintenance Netherlands, 29-7-2024) — Basic empty weight and CG
2. **Airplane Flight Manual Reims/Cessna F172N** (Edition 4, September 1978) — Station arms, CG limits, fuel data, loading graph. Includes handwritten corrections specific to PH-GYS (updated MTOW from 1043→1089 kg, utility from 910→952 kg)
3. **W&B Quick Reference Card** — PH-GYS specific summary (C172-P long range tanks configuration)
4. **Operations Manual PH-GYS** — Stichting Vliegmaterieel Schiphol (Version 22-04-2025)
