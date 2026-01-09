export interface Patient {
  id: string | number;
  name: string;
  isFirstTime?: boolean;
  priority?: {
    isWheelchair?: boolean;
    isPregnant?: boolean;
    isElderly?: boolean;
  };
  service: string;
  professional: string;
  arrival: string;
  waitTime: number;
  status: 'waiting' | 'in_service';
}

export interface UnitData {
  id: number | string;
  name: string;
  patients: Patient[];
  totalAttended?: number;
}

export interface ReceptionUnitStats {
  fila: number;
  tempo_medio: number;
  total_passaram: number;
  nome_unidade?: string;
}

export interface ReceptionResponse {
  global: {
    total_fila: number;
    tempo_medio: number;
  };
  por_unidade: Record<string, ReceptionUnitStats>;
}