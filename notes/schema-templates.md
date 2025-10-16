# JSON-LD Schema Templates
_Last updated: 2025-10-16_

These are copy-paste templates that **validate** against the schemas in `/schemas`.

---

## 🟩 Event (validates against `/schemas/event.schema.json`)
```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Beginners Photography Workshop",
  "url": "https://www.alanranger.com/workshops/beginners-photography",
  "image": [
    "https://www.alanranger.com/images/workshops/beginners-1.jpg",
    "https://www.alanranger.com/images/workshops/beginners-2.jpg"
  ],
  "description": "A hands-on introduction to photography covering exposure, composition, and camera control.",
  "startDate": "2025-12-01T09:00:00+00:00",
  "endDate": "2025-12-01T17:00:00+00:00",
  "organizer": {
    "@type": "Organization",
    "name": "Alan Ranger Photography",
    "url": "https://www.alanranger.com/",
    "logo": "https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/b859ad2b-1442-4595-b9a4-410c32299bf8/ALAN+RANGER+photography+LOGO+BLACK.+switched+small.png?format=1500w",
    "address": "45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW"
  },
  "location": {
    "@type": "Place",
    "name": "Coventry Studio",
    "address": "45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW"
  },
  "offers": {
    "@type": "Offer",
    "price": "20",
    "priceCurrency": "GBP",
    "availability": "https://schema.org/InStock",
    "url": "https://www.alanranger.com/workshops/beginners-photography",
    "validFrom": "2025-12-01T09:00:00+00:00"
  }
}
