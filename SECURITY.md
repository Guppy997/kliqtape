# Sicherheit

## Lücken melden

Bitte **kein öffentliches Issue** für Sicherheitslücken. Stattdessen über GitHub:
**Security → Report a vulnerability** in diesem Repository (private Meldung, nur für die
Maintainer sichtbar). Wir antworten in der Regel innerhalb einer Woche und nennen dich gern
beim Fix, wenn du das möchtest.

## Was du wissen solltest

Kliqtape ist ein **Prototyp**. Einige Grenzen sind bekannt und offen dokumentiert — sie zu melden
ist nicht nötig, Ideen zur Lösung sind aber willkommen:

- **Keine Ende-zu-Ende-Verschlüsselung.** Der Server kann alle Inhalte lesen, auch Seite B. Die
  App sagt das selbst (Profil → „Was der Server sieht“). Geplant ist E2EE für Seite B über eine
  geprüfte Bibliothek (Signal-Protokoll oder MLS), siehe [docs/CONCEPT.md](docs/CONCEPT.md) §8.
- **Identität ist ein Name plus Zugangscode**, noch kein Konto mit Passkey (§16.2).
- **Medien sind über ihre zufällige ID abrufbar**, ohne Mitgliedschaftsprüfung (§16.5) —
  ausgenommen Film und Imposter-Beiträge vor ihrer Freigabe.
- **Kein Backup-Konzept** für den Betrieb (§16.4).

Jede verändernde API-Route hat einen automatischen Test, der prüft, dass Fremde sie nicht
benutzen können (`backend/tests/`).
