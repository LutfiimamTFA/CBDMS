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
      title: 'Mengelola Tim & Pengguna',
      content: `
        Sebagai Super Admin, Anda memiliki kontrol penuh atas semua akun pengguna.
        <br/><br/>
        - **Undang Pengguna Baru:** Gunakan tombol "Add User" di halaman Users untuk membuat akun baru. Anda bisa menentukan peran (Manager, Employee, Client) dan password awal saat pembuatan.
        <br/>
        - **Edit & Hapus Pengguna:** Dari daftar pengguna, Anda bisa mengedit detail seperti nama dan peran, atau menghapus pengguna secara permanen.
        <br/>
        - **Generate Temp Password:** Fitur ini memungkinkan Anda membuat password sementara untuk pengguna yang lupa kata sandi. Pengguna tersebut akan dipaksa mengubahnya saat login berikutnya.
      `,
    },
    {
      id: 'admin_settings',
      title: 'Menyesuaikan Aplikasi (Settings)',
      content: `
        Menu 'Settings' adalah kokpit Anda untuk mengkonfigurasi aplikasi agar sesuai dengan kebutuhan perusahaan.
        <br/><br/>
        - **Company:** Ubah nama dan logo perusahaan Anda di sini. Ini akan muncul di seluruh aplikasi.
        <br/>
        - **Brands:** Kelola daftar merek atau klien yang akan ditandai pada setiap tugas.
        <br/>
        - **Workflow:** Tambah, edit, atau hapus kolom status di Papan Kanban. Sesuaikan alur kerja tim Anda.
        <br/>
        - **Roles & Permissions:** Atur izin secara detail. Tentukan apa yang bisa dan tidak bisa dilakukan oleh setiap peran.
        <br/>
        - **Navigation:** Kontrol menu sidebar mana yang terlihat untuk setiap peran untuk menyederhanakan antarmuka.
      `,
    },
    {
      id: 'admin_data',
      title: 'Keamanan & Manajemen Data',
      content: `
        Jaga keamanan dan portabilitas data perusahaan Anda.
        <br/><br/>
        - **Export Data:** Gunakan fitur ini untuk membuat backup data Anda dalam format JSON atau CSV.
        <br/>
        - **Danger Zone:** Tombol "Reset Application Data" akan menghapus semua data transaksional (tugas, proyek, dll.) tetapi akan MEMPERTAHANKAN semua akun pengguna. Gunakan dengan hati-hati.
      `,
    },
  ],
  manager: [
    {
      id: 'manager_project_management',
      title: 'Manajemen Proyek & Tugas',
      content: `
        Sebagai Manajer, fokus Anda adalah memastikan proyek berjalan lancar.
        <br/><br/>
        - **Papan Kanban:** Gunakan papan ini untuk memantau progres tim secara visual. Seret (drag) kartu tugas untuk mengubah statusnya.
        <br/>
        - **Daftar Tugas:** Gunakan filter berlapis (berdasarkan judul, merek, status, prioritas) untuk menemukan tugas spesifik dengan cepat.
        <br/>
        - **Kalender Tim:** Ini adalah 'pandangan mata elang' Anda. Lihat timeline semua proyek, identifikasi jadwal yang padat, dan geser tugas untuk menjadwal ulang.
      `,
    },
    {
      id: 'manager_team_management',
      title: 'Mengelola Tim Anda',
      content: `
        Berdayakan tim Anda untuk mencapai hasil terbaik.
        <br/><br/>
        - **Mendelegasikan Tugas:** Saat membuat atau mengedit tugas, Anda bisa menugaskannya ke satu atau lebih karyawan.
        <br/>
        - **Ceklis Harian:** Buka halaman 'Daily Checklist' dan gunakan filter nama untuk memantau penyelesaian tugas rutin harian anggota tim Anda.
      `,
    },
    {
      id: 'manager_automation',
      title: 'Otomatisasi & Efisiensi',
      content: `
        Hemat waktu dengan fitur otomatisasi kami.
        <br/><br/>
        - **Template Tugas Berulang:** Buka 'Settings > Recurring Tasks' untuk membuat template tugas yang akan dibuat secara otomatis (harian, mingguan, dll.). Ini sangat berguna untuk laporan, rapat rutin, atau tugas-tugas administrasi lainnya.
      `,
    },
    {
      id: 'manager_reports',
      title: 'Analisis & Laporan',
      content: `
        Gunakan data untuk membuat keputusan yang lebih baik.
        <br/><br/>
        - **Halaman Laporan:** Analisis performa tim, lihat tingkat penyelesaian tepat waktu, dan identifikasi di mana sebagian besar waktu kerja dihabiskan melalui grafik interaktif.
      `,
    },
     {
      id: 'manager_social_media',
      title: 'Alur Kerja Media Sosial',
      content: `
        Kelola konten untuk klien atau merek Anda secara profesional.
        <br/><br/>
        - **Review Konten:** Di halaman 'Social Media', Anda akan melihat postingan yang menunggu persetujuan.
        - **Approval:** Buka setiap postingan untuk me-review, lalu gunakan tombol "Approve & Schedule" untuk menjadwalkan atau "Reject" untuk mengembalikannya ke drafter.
      `,
    },
  ],
  employee: [
    {
      id: 'employee_my_work',
      title: 'Pusat Kerja Anda ("My Work")',
      content: `
        Halaman 'My Work' adalah pusat komando produktivitas harian Anda.
        <br/><br/>
        - **Fokus Hari Ini:** Tab ini secara otomatis menampilkan tugas yang paling relevan untuk Anda kerjakan hari ini (tugas yang jatuh tempo, lewat jatuh tempo, atau sedang berjalan).
        <br/>
        - **Semua Tugas Saya:** Gunakan tab ini untuk melihat daftar lengkap semua tugas yang ditugaskan kepada Anda, tidak peduli statusnya.
        <br/>
        - **Ceklis Harian:** Laporkan penyelesaian tugas rutin Anda dengan cepat di bagian 'Daily Checklist'.
      `,
    },
    {
      id: 'employee_doing_tasks',
      title: 'Mengerjakan Tugas',
      content: `
        Fokus pada eksekusi dan kolaborasi yang efektif.
        <br/><br/>
        - **Ubah Status:** Di Papan Kanban, cukup seret tugas Anda ke kolom yang sesuai untuk memperbarui statusnya.
        <br/>
        - **Time Tracker:** Di detail tugas, gunakan tombol 'Start/Stop Session' untuk melacak waktu kerja Anda secara akurat.
        <br/>
        - **Kolaborasi:** Gunakan fitur komentar untuk berdiskusi. Gunakan '@' diikuti nama (misal: @Budi) untuk me-mention rekan setim dan memastikan mereka mendapat notifikasi.
      `,
    },
     {
      id: 'employee_social_media',
      title: 'Mengirim Konten',
      content: `
        Jika peran Anda melibatkan pembuatan konten.
        <br/><br/>
        - **Buat Postingan:** Buka halaman 'Social Media' dan gunakan tombol "Create Post".
        - **Isi Detail:** Tulis caption, unggah gambar/video, dan atur jadwal tayang yang diinginkan.
        - **Kirim untuk Persetujuan:** Setelah selesai, klik "Submit for Approval". Manajer Anda akan menerima notifikasi untuk me-reviewnya.
      `,
    },
  ],
  client: [
    {
      id: 'client_monitoring',
      title: 'Memantau Progres Proyek',
      content: `
        Sebagai Klien, Anda memiliki akses transparan untuk melihat kemajuan pekerjaan.
        <br/><br/>
        - **Melihat Tugas:** Anda dapat melihat tugas-tugas yang relevan dengan proyek Anda di Papan Kanban atau Daftar Tugas.
        <br/>
        - **Memberikan Feedback:** Buka detail tugas untuk melihat informasi lengkap dan gunakan kolom komentar untuk memberikan feedback atau mengajukan pertanyaan langsung kepada tim.
      `,
    },
    {
      id: 'client_approval',
      title: 'Proses Persetujuan Konten',
      content: `
        Berikan persetujuan untuk konten media sosial dengan mudah.
        <br/><br/>
        - **Kalender Konten:** Buka halaman 'Social Media' untuk melihat jadwal konten yang telah disiapkan untuk Anda.
        <br/>
        - **Review & Approve:** Klik pada setiap postingan untuk melihat pratinjau. Jika Anda adalah approver yang ditunjuk, Anda akan melihat tombol untuk menyetujui ("Approve") konten tersebut.
      `,
    },
  ],
};
