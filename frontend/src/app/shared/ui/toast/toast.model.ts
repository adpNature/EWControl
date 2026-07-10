export type ToastType = 'success' | 'warning' | 'danger' | 'info';

export interface ToastRequest {
  type: ToastType;
  message: string;
}

export interface Toast extends ToastRequest {
  id: number;
}
