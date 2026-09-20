export type VehicleModel = { id: string; make: string; model: string; year: number | null };

export const modelLabel = (m: VehicleModel) => `${m.make} · ${m.model}${m.year ? ` · ${m.year}` : ''}`;
