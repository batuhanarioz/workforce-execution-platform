# Workforce Execution Platform

Saha operasyonlarının günlük planlama, yürütme, onay ve raporlama süreçlerini tek bir platformda birleştiren bir workforce execution çözümü.

## İçerik

```text
apps/web    Next.js masaüstü uygulaması (planlama, onay, raporlama, yönetim)
apps/mobile React Native mobil uygulaması (saha yürütme, offline giriş)
apps/api    NestJS REST API (iş kuralları, yetkilendirme, veri erişimi)
packages/shared Ortak domain tipleri, enum'lar ve DTO şekilleri
packages/ui Ortak UI bileşenleri
packages/config Ortak yapılandırma
```

## Mimari Özeti

- **Modüler monolit**: Tek veritabanı, tek deployment birimi; modüller (auth, master-data, daily-plans, daily-facts, approvals, reports, audit-logs) net sınırlarla ayrılmış.
- **Rol ve lokasyon bazlı yetkilendirme**: JWT + RBAC + lokasyon guard katmanı.
- **Durum bazlı onay zinciri**: Head of Master → Site Chief → Project Manager.
- **Offline-first mobil**: SQLite tabanlı yerel depolama, senkronizasyon kuyruğu, SecureStore ile güvenli oturum.
- **Cache**: Redis üzerinden master data ve raporlama sorguları için performans katmanı.

## Yerel Çalıştırma

```bash
pnpm install
pnpm --dir apps/api db:setup
pnpm dev:api
pnpm dev:web
```

## Docker ile Çalıştırma

```bash
docker compose up --build
```

Bu komut şunları ayağa kaldırır:
- PostgreSQL — `localhost:5432`
- Redis — `localhost:6379`
- API — `localhost:3001`
- Web uygulaması — `localhost:3000`
- Mobil web önizleme — `localhost:19006`

Mobil native uygulama Expo ile ayrı çalışır; Docker önizlemesi web üzerinden render edilen mobil arayüzü açar.

## Test ve Doğrulama

```bash
pnpm -r typecheck
pnpm -r test
```

CI pipeline (`.github/workflows/ci.yml`) her push/PR'da typecheck, test ve build adımlarını otomatik çalıştırır.
