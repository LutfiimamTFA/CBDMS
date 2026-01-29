
// @/lib/guide-content.ts

export type GuideTopic = {
  id: string;
  title: string;
  content: string;
};

export type GuideContent = {
  super_admin: GuideTopic[];
  manager: GuideTopic[];
  employee: GuideTopic[];
  client: GuideTopic[];
};

export const guideContent: GuideContent = {
  super_admin: [
    {
      id: 'admin_users',
      title: 'Bagaimana cara saya mengelola tim dan pengguna?',
      content: `
Sebagai Super Admin, Anda memiliki kontrol penuh atas semua akun pengguna di halaman **Admin > Users**.

*   **Undang Pengguna Baru:** Gunakan tombol "Add User" untuk membuat akun baru. Anda bisa menentukan peran (Manager, Employee, Client) dan password awal saat pembuatan.
*   **Edit & Hapus Pengguna:** Dari daftar pengguna, Anda bisa mengedit detail seperti nama dan peran, atau menghapus pengguna secara permanen.
*   **Akses Darurat:** Anda bisa memberikan status "Emergency Admin" kepada seorang Manajer jika diperlukan.
      `,
    },
    {
      id: 'admin_settings',
      title: 'Bagaimana cara saya menyesuaikan pengaturan aplikasi?',
      content: `
Menu **Admin > Settings** adalah pusat kendali Anda untuk menyesuaikan aplikasi.

*   **Company:** Ubah nama dan logo perusahaan Anda.
*   **Brands:** Kelola daftar merek atau klien yang akan ditandai pada setiap tugas.
*   **Workflow:** Sesuaikan alur kerja (kolom status) untuk setiap modul (Tasks, Social Media, Web) di Papan Kanban.
*   **Roles & Permissions:** Atur izin secara detail untuk setiap peran.
*   **Navigation:** Atur menu sidebar mana yang bisa dilihat oleh setiap peran.
*   **Recurring Tasks:** Buat template untuk tugas yang dibuat secara otomatis.
      `,
    },
    {
      id: 'admin_data',
      title: 'Bagaimana saya mengelola keamanan dan backup data?',
      content: `
Jaga keamanan dan portabilitas data perusahaan Anda melalui halaman **Admin > Data**.

*   **Export Data:** Gunakan fitur ini untuk membuat backup data Anda dalam format JSON atau CSV.
*   **Import Data:** Proses restore data dilakukan secara manual melalui konsol Firebase untuk keamanan maksimal.
*   **Danger Zone:** Tombol "Reset Application Data" akan menghapus **semua data transaksional** (tugas, proyek, dll.) tetapi akan **MEMPERTAHANKAN semua akun pengguna**. Gunakan dengan sangat hati-hati.
      `,
    },
    {
      id: 'manager_reports',
      title: 'Bagaimana cara melihat laporan dan analisis kinerja?',
      content: `
Gunakan data untuk membuat keputusan yang lebih baik di halaman **Reports**.

*   **Analisis Tim:** Lihat metrik kunci seperti jumlah tugas selesai, rata-rata waktu penyelesaian, dan tingkat ketepatan waktu.
*   **Filter Data:** Gunakan filter berdasarkan karyawan dan periode waktu untuk mendapatkan wawasan yang lebih spesifik.
      `,
    },
  ],
  manager: [
    {
      id: 'manager_project_management',
      title: 'Bagaimana cara terbaik untuk mengelola proyek tim saya?',
      content: `
Sebagai Manajer, fokus Anda adalah memastikan proyek berjalan lancar.

*   **Papan Kanban:** Buka halaman **Dashboard**. Gunakan papan ini untuk memantau progres tim secara visual. Seret kartu tugas untuk mengubah statusnya.
*   **Daftar Tugas:** Buka **Tasks > Task List**. Gunakan filter berlapis (berdasarkan judul, merek, status, prioritas) untuk menemukan tugas spesifik dengan cepat.
*   **Jadwal Tim:** Buka **Tasks > Schedule**. Lihat timeline semua proyek, identifikasi jadwal yang padat, dan geser tugas untuk menjadwal ulang.
      `,
    },
    {
      id: 'manager_team_management',
      title: 'Bagaimana cara mendelegasikan tugas dan memantau tim?',
      content: `
Berdayakan tim Anda untuk mencapai hasil terbaik.

*   **Mendelegasikan Tugas:** Saat membuat atau mengedit tugas, Anda bisa menugaskannya ke satu atau lebih karyawan di dalam tim Anda.
*   **Ceklis Harian:** Buka halaman **Daily Checklist** dan gunakan filter nama untuk memantau penyelesaian tugas rutin harian anggota tim Anda.
*   **Laporan Kinerja:** Halaman **Reports** memberikan gambaran umum tentang produktivitas tim Anda.
      `,
    },
    {
      id: 'manager_social_media',
      title: 'Bagaimana saya menyetujui atau menolak konten?',
      content: `
Kelola konten untuk klien atau merek Anda secara profesional di modul **Social Media**.

*   **Review Konten:** Buka detail postingan yang berstatus "Preview". Di sini Anda bisa melihat pratinjau, detail, dan file yang diunggah oleh tim.
*   **Approval & Revisi:**
    *   Klik **Approve & Complete** jika konten sudah final.
    *   Klik **Request Revisions** jika ada yang perlu diperbaiki. Anda akan diminta membuat daftar poin revisi untuk tim.
      `,
    },
     {
      id: 'manager_automation',
      title: 'Bagaimana cara membuat tugas rutin secara otomatis?',
      content: `
Hemat waktu dengan fitur otomatisasi di **Admin > Settings > Recurring Tasks**.

*   **Buat Template:** Tentukan judul, deskripsi, frekuensi (harian, mingguan), dan siapa yang akan ditugaskan.
*   **Tugas Otomatis:** Sistem akan secara otomatis membuat tugas berdasarkan template ini pada jadwal yang telah ditentukan. Ini sangat berguna untuk laporan, rapat rutin, atau tugas-tugas administrasi lainnya.
      `,
    },
  ],
  employee: [
    {
      id: 'employee_my_work',
      title: 'Di mana saya bisa melihat semua pekerjaan saya?',
      content: `
Halaman **My Work** adalah pusat komando produktivitas harian Anda.

*   **Today's Focus:** Bagian ini secara otomatis menampilkan tugas yang paling relevan untuk Anda: tugas yang jatuh tempo hari ini, sudah lewat jatuh tempo, atau yang sedang Anda kerjakan.
*   **Daily Checklist:** Di sisi kanan, laporkan penyelesaian tugas-tugas rutin harian Anda dengan cepat.
*   **Action Items:** Lihat mention dan sub-tugas yang ditugaskan langsung kepada Anda.
      `,
    },
    {
      id: 'employee_doing_tasks',
      title: 'Bagaimana cara saya mengerjakan tugas dan berkolaborasi?',
      content: `
Fokus pada eksekusi dan kolaborasi yang efektif di dalam detail setiap tugas.

*   **Ubah Status:** Cukup seret kartu tugas Anda di papan Kanban atau ubah melalui menu dropdown di detail tugas.
*   **Time Tracker:** Gunakan tombol 'Start/Stop Session' untuk melacak waktu kerja Anda secara akurat.
*   **Sub-tugas:** Pecah pekerjaan besar menjadi langkah-langkah kecil dengan membuat sub-tugas.
*   **Kolaborasi:** Gunakan fitur **Comments** untuk berdiskusi. Gunakan \`@\` diikuti nama (misal: \`@Budi\`) untuk me-mention rekan setim dan memastikan mereka mendapat notifikasi.
      `,
    },
     {
      id: 'employee_submission',
      title: 'Bagaimana cara saya mengirimkan pekerjaan untuk direview?',
      content: `
Setelah pekerjaan selesai, ikuti langkah-langkah ini di dalam detail tugas/konten:

1.  **Lengkapi Checklist:** Pastikan semua *sub-tugas* dan *poin revisi* (jika ada) sudah Anda centang.
2.  **Unggah Hasil Akhir:** Upload file hasil kerja Anda di bagian **Deliverables**. Ini penting sebagai bukti pekerjaan.
3.  **Kirim untuk Review:** Klik tombol **Submit for Review**. Status tugas akan berubah menjadi "Preview" dan Manajer Anda akan menerima notifikasi.
      `,
    },
  ],
  client: [
    {
      id: 'client_monitoring',
      title: 'Bagaimana cara saya memantau progres proyek?',
      content: `
Sebagai Klien, Anda memiliki akses transparan untuk melihat kemajuan pekerjaan melalui *share link* yang Anda terima.

*   **Melihat Tugas:** Anda dapat melihat tugas-tugas yang relevan dengan proyek Anda di Papan Kanban atau Daftar Tugas, sesuai dengan apa yang dibagikan kepada Anda.
*   **Memberikan Feedback:** Buka detail tugas untuk melihat informasi lengkap dan gunakan kolom komentar untuk memberikan feedback atau mengajukan pertanyaan langsung kepada tim.
      `,
    },
    {
      id: 'client_approval',
      title: 'Bagaimana cara saya memberikan persetujuan (approval)?',
      content: `
Jika Anda memiliki hak akses untuk mengubah status:

*   **Review & Approve:** Buka detail tugas atau konten yang berstatus "Preview".
*   **Ubah Status:** Jika pekerjaan sudah sesuai, ubah statusnya menjadi "Done". Jika ada revisi, ubah statusnya menjadi "Revisi" dan berikan catatan di kolom komentar.
      `,
    },
  ],
};
