/** Mirror of the app's checklist catalogue (src/domain/inspection.ts) for labels and grouping. */
export const INSPECTION_GROUPS: { key: string; title: string; items: { key: string; label: string }[] }[] = [
  { key: 'exterior', title: 'Exterior & Body', items: [
    ['body_panels', 'Body Panels / Dents'], ['paint', 'Paint / Scratches'], ['bumpers', 'Front & Rear Bumpers'], ['windshield', 'Windshield'],
    ['rear_glass', 'Rear Glass'], ['side_windows', 'Side Windows'], ['mirrors', 'Side Mirrors'], ['doors_locks', 'Doors, Hinges & Locks'],
    ['hood_trunk', 'Hood & Trunk / Tailgate'], ['wipers', 'Wiper Blades'], ['headlights', 'Headlights (Low / High)'], ['tail_brake_lights', 'Tail & Brake Lights'],
    ['signal_front_left', 'Signal Light — Front Left'], ['signal_front_right', 'Signal Light — Front Right'], ['signal_rear_left', 'Signal Light — Rear Left'],
    ['signal_rear_right', 'Signal Light — Rear Right'], ['signal_mirror', 'Signal Light — Side Mirror Repeaters'], ['hazard_lights', 'Hazard Lights'],
    ['reverse_lights', 'Reverse Lights'], ['plate_lights', 'License Plate Lights'], ['fog_drl', 'Fog Lights / DRL'], ['sunroof', 'Sunroof / Moonroof'], ['roof_rack', 'Roof Rack / Antenna'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'tires', title: 'Tires & Wheels', items: [
    ['tire_front_left', 'Tire — Front Left'], ['tire_front_right', 'Tire — Front Right'], ['tire_rear_left', 'Tire — Rear Left'], ['tire_rear_right', 'Tire — Rear Right'],
    ['tire_additional', 'Additional Tires (6+ wheels)'], ['spare_tire', 'Spare Tire'], ['rims_hubcaps', 'Rims / Hubcaps'], ['lug_nuts', 'Lug Nuts / Wheel Lock Key'], ['tpms', 'TPMS Sensors'], ['alignment', 'Wheel Alignment / Pull'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'engine', title: 'Engine Bay', items: [
    ['engine_starts', 'Engine Starts'], ['idle_noise', 'Idle Quality / Noise'], ['engine_oil', 'Engine Oil Level & Condition'], ['coolant', 'Coolant Level'], ['brake_fluid', 'Brake Fluid'],
    ['ps_fluid', 'Power Steering Fluid'], ['atf', 'Transmission Fluid'], ['washer_fluid', 'Washer Fluid'], ['leaks', 'Oil / Coolant / Fuel Leaks'], ['serpentine_belt', 'Serpentine / Drive Belt'],
    ['timing', 'Timing Belt / Chain'], ['alternator', 'Alternator & Charging'], ['starter', 'Starter Motor'], ['battery_12v', '12V Battery Condition'], ['battery_terminals', 'Battery Terminals / Corrosion'],
    ['air_filter', 'Air Filter'], ['cabin_filter', 'Cabin Filter'], ['radiator_hoses', 'Radiator & Hoses'], ['cooling_fan', 'Cooling Fan'], ['throttle_body', 'Throttle Body'], ['injectors', 'Fuel Injectors'],
    ['fuel_pump', 'Fuel Pump / Fuel Filter'], ['spark_coils', 'Spark Plugs / Ignition Coils'], ['turbo', 'Turbo / Supercharger'], ['engine_mounts', 'Engine Mounts'], ['exhaust', 'Exhaust / Catalytic Converter'], ['vacuum_hoses', 'Vacuum Hoses / PCV'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'electrical', title: 'Electrical & Electronics', items: [
    ['ecu_dtc', 'ECU / OBD Fault Codes'], ['dash_warning', 'Dashboard Warning Lights'], ['cluster', 'Instrument Cluster / Gauges'], ['dash_controls', 'Dashboard Switches & Controls'],
    ['infotainment', 'Infotainment / Head Unit'], ['camera_sensors', 'Reverse Camera / Parking Sensors'], ['horn', 'Horn'], ['power_windows', 'Power Windows'], ['central_lock', 'Central Locking / Key Fob'],
    ['ac_compressor', 'A/C Compressor'], ['ac_cooling', 'A/C Cooling Performance'], ['blower', 'Blower / Vents'], ['interior_lights', 'Interior & Courtesy Lights'], ['charging_ports', 'USB / 12V Sockets'],
    ['wiper_washer_fn', 'Wiper & Washer Function'], ['wiring', 'Wiring Harness / Fuses'], ['sensors', 'Sensors (O2, MAF, Crank, Cam)'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'brakes', title: 'Brakes, Steering & Suspension', items: [
    ['brake_pads_front', 'Brake Pads — Front'], ['brake_pads_rear', 'Brake Pads — Rear'], ['brake_discs', 'Brake Discs / Drums'], ['brake_lines', 'Brake Lines & Hoses'], ['parking_brake', 'Parking / Hand Brake'],
    ['abs', 'ABS Function'], ['steering_play', 'Steering Play / Noise'], ['power_steering', 'Power Steering (EPS / Hydraulic)'], ['shocks', 'Shock Absorbers / Struts'], ['springs_bushings', 'Springs, Bushings & Links'],
    ['ball_joints', 'Ball Joints / Tie Rods'], ['cv_joints', 'CV Joints / Boots'], ['wheel_bearings', 'Wheel Bearings'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'drivetrain', title: 'Transmission & Drivetrain', items: [
    ['gear_shift', 'Gear Shift (Manual / Auto / CVT)'], ['clutch', 'Clutch'], ['trans_noise', 'Transmission Noise / Slip'], ['driveshaft', 'Drive Shaft / Axles'], ['differential', 'Differential'], ['transfer_case', 'Transfer Case (4WD / AWD)'], ['driveline_leaks', 'Driveline Leaks'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'hybrid', title: 'Hybrid / EV System', items: [
    ['hv_battery', 'High-Voltage Battery (SOH)'], ['hv_cooling', 'HV Battery Cooling'], ['charge_port', 'Charging Port'], ['charger_cable', 'Charger / Cable'], ['inverter', 'Inverter / DC-DC Converter'],
    ['e_motor', 'Electric Motor / Generator'], ['regen', 'Regenerative Braking'], ['ev_warnings', 'Hybrid / EV Warning Lights'], ['aux_battery', '12V Auxiliary Battery'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'interior', title: 'Interior & Safety', items: [
    ['seats', 'Seats & Upholstery (count)'], ['seat_belts', 'Seat Belts'], ['airbags', 'Airbags (SRS Light)'], ['steering_wheel', 'Steering Wheel & Stalks'], ['pedals', 'Pedals'], ['floor_mats', 'Floor Mats / Carpets'], ['headliner', 'Headliner / Trim'], ['odor_water', 'Odor / Water Ingress'],
  ].map(([key, label]) => ({ key, label })) },
  { key: 'received', title: 'Items Received', items: [
    ['keys', 'Key(s)'], ['registration_card', 'OR / CR'], ['service_book', 'Service Book / Log'], ['insurance', 'Insurance'], ['tools_jack', 'Tools / Jack / Wrench'], ['ewd', 'Early Warning Device'],
    ['fire_extinguisher', 'Fire Extinguisher'], ['accessories', 'Dashcam / Accessories'], ['personal_items', 'Personal Items Left (see remarks)'],
  ].map(([key, label]) => ({ key, label })) },
];

export const ITEM_LABELS = new Map(INSPECTION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));
