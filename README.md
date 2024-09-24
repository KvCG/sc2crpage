# SC2CR Web Application

A web application to track StarCraft 2 player statistics using the Blizzard Community API and other resources.

## Project Info
- **Website**: [SC2CR](https://sc2cr.vercel.app/)
- **Resources**:
  - [Blizzard API Getting Started Guide](https://develop.battle.net/documentation/guides/getting-started)
  - [Blizzard StarCraft II Community APIs](https://develop.battle.net/documentation/starcraft-2/community-apis)
  - [SC2Pulse API Documentation](https://sc2pulse.nephest.com/sc2/doc/swagger-ui/index.html)

## UI Library: Mantine
We use [Mantine](https://mantine.dev/getting-started/) as our UI library. Mantine provides a robust set of components and hooks to speed up development.

### Required Packages:
To use Mantine, you'll need to install several dependencies. These are automatically installed during setup (see below).

## Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
```

### 2. Install Dependencies
Run the following command to install all necessary packages:
```bash
npm install
```

### 3. Obtain ladderCR.csv File
Request the ```ladderCR.csv``` file: Contact NeO or Kerverus to get this file.


### 5. Place the Data File
After building the project with ```npm run build```, place the ladderCR.csv file inside the dist/data directory:
```bash
dist/data/ladderCR.csv
```

### 6. Start Development Server
Run the following command
```bash
npm run dev
```