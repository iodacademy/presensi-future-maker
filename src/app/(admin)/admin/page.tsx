import { redirect } from 'next/navigation';

/**
 * Beranda admin mengarah ke dashboard.
 *
 * Sebelumnya mengarah ke daftar kelas. Dashboard menjawab pertanyaan yang
 * pertama kali diajukan admin saat membuka aplikasi -- berapa yang hadir,
 * siapa yang tertinggal -- sedangkan daftar kelas adalah tempat menyusun, yang
 * dituju setelah tahu apa yang perlu disusun.
 *
 * The admin home points at the dashboard.
 *
 * It previously pointed at the class list. The dashboard answers the question
 * an admin asks first on opening the app -- how many attended, who is falling
 * behind -- while the class list is where things are built, visited once it is
 * clear what needs building.
 */
export default function AdminPage() {
  redirect('/admin/dashboard');
}
