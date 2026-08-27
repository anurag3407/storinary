# AWS Lightsail VPS (3.6.209.14) Deployment Guide & AI Skill Prompt

> **Purpose:** Use this markdown document as a self-contained guide or prompt for an AI to deploy, configure, and manage 20+ applications on the AWS Lightsail VPS with subdomains, PM2, Nginx, and free SSL.

---

## 🖥️ Server Details

* **Static IPv4:** `3.6.209.14`
* **Default User:** `ubuntu`
* **Local SSH Key Location:** `~/Downloads/LightsailDefaultKey-ap-south-1.pem`
* **Apps Directory:** `/home/ubuntu/apps/`
* **Installed Stack:**
  * Node.js 22 LTS, npm, pnpm, yarn
  * PM2 (configured to auto-start on boot)
  * Docker & Docker Compose
  * Nginx & Certbot (Let's Encrypt)
  * 4 GB SSD Swap Memory
  * UFW Firewall (Ports 22, 80, 443 open)

---

## 🤖 Instructions for AI / Quick Deploy Prompt

Whenever deploying a new app, execute the following steps in order:

### 1. Check Running Apps and Find the Next Free Port
```bash
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "list-apps"
```
*(Choose an unused port: `3000`, `3001`, `3002`, `3003`, etc.)*

### 2. Transfer / Clone the Project
```bash
# Option A: From local folder
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  -e "ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem" \
  ./ ubuntu@3.6.209.14:/home/ubuntu/apps/<app-name>/

# Option B: Clone from Git
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "
  cd /home/ubuntu/apps
  if [ ! -d '<app-name>' ]; then
    git clone <repo-url> <app-name>
  else
    cd <app-name> && git pull
  fi
"
```

### 3. Setup Environment Variables
Create `/home/ubuntu/apps/<app-name>/.env`:
```env
PORT=<allocated-port>
NEXT_PUBLIC_APP_URL=https://<subdomain.domain.com>
NODE_ENV=production
```

### 4. Install Dependencies, Migrate Database & Build
```bash
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "
  cd /home/ubuntu/apps/<app-name>
  npm install --production=false
  
  # Run Prisma migrations if present
  if [ -f 'prisma/postgres/schema.prisma' ]; then
    npx prisma migrate deploy --schema prisma/postgres/schema.prisma
  elif [ -f 'prisma/schema.prisma' ]; then
    npx prisma migrate deploy || npx prisma db push
  fi
  
  npm run build
"
```

### 5. Start with PM2 (Auto-Restarts on Reboot)
```bash
# For Next.js:
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "
  cd /home/ubuntu/apps/<app-name>
  pm2 delete '<app-name>' 2>/dev/null || true
  PORT=<allocated-port> pm2 start npm --name '<app-name>' -- start -- -p <allocated-port>
  pm2 save
"

# For Standard Node.js / Express:
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "
  cd /home/ubuntu/apps/<app-name>
  pm2 delete '<app-name>' 2>/dev/null || true
  PORT=<allocated-port> pm2 start dist/index.js --name '<app-name>'
  pm2 save
"
```

### 6. Configure Nginx Reverse Proxy (1 Command)
```bash
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "
  sudo add-app <subdomain.domain.com> <allocated-port>
"
```

### 7. Issue Free HTTPS SSL Certificate
```bash
ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "
  sudo certbot --nginx -d <subdomain.domain.com> --non-interactive --agree-tos --register-unsafely-without-email --redirect
"
```

---

## 🛠️ Management & Monitoring Cheat Sheet

| Task | Command |
| :--- | :--- |
| **List all subdomains & running apps** | `ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "list-apps"` |
| **Check CPU / RAM usage** | `ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "pm2 status"` |
| **View real-time logs** | `ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "pm2 logs <app-name> --lines 50"` |
| **Restart an app** | `ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "pm2 restart <app-name>"` |
| **Delete an app & free port** | `ssh -i ~/Downloads/LightsailDefaultKey-ap-south-1.pem ubuntu@3.6.209.14 "pm2 delete <app-name> && sudo rm -f /etc/nginx/sites-enabled/<subdomain> /etc/nginx/sites-available/<subdomain> && sudo systemctl reload nginx && pm2 save"` |
