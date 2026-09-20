import Swal from 'sweetalert2';

/** SweetAlert2 themed to the console: dark, rounded, uppercase, M-blue confirm. */
export const swal = Swal.mixin({
  background: '#151517',
  color: '#ffffff',
  confirmButtonColor: '#4f9be3',
  cancelButtonColor: '#2c2c31',
  buttonsStyling: true,
  customClass: { popup: 'swal-bm', title: 'swal-bm-title', confirmButton: 'swal-bm-btn', cancelButton: 'swal-bm-btn' },
});

export const confirmDialog = async (title: string, html: string, confirmText = 'Confirm') =>
  (await swal.fire({ title, html, icon: 'question', showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancel', reverseButtons: true })).isConfirmed;

export const warnDialog = async (title: string, html: string, confirmText = 'Proceed anyway') =>
  (await swal.fire({ title, html, icon: 'warning', showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Stop', confirmButtonColor: '#e5142b', reverseButtons: true })).isConfirmed;
