#!/bin/bash

# EA SPORTS FC 2025 eSports Platform - SSL Setup Script
# This script sets up SSL certificates for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║               SSL Certificate Setup for Production              ║"
echo "║                                                                  ║"
echo "║          EA SPORTS FC 2025 eSports Platform                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Domain configuration
DOMAIN="esports-fc2025.com"
API_DOMAIN="api.esports-fc2025.com"
ADMIN_DOMAIN="admin.esports-fc2025.com"
MONITORING_DOMAIN="monitoring.esports-fc2025.com"
EMAIL="admin@esports-fc2025.com"

# SSL directory
SSL_DIR="./ssl"
mkdir -p $SSL_DIR

print_status "SSL Certificate Setup Options:"
echo "1. Let's Encrypt (Automatic - Recommended for production)"
echo "2. Self-signed certificates (Development/Testing)"
echo "3. Use existing certificates"
echo ""

read -p "Choose option (1-3): " choice

case $choice in
    1)
        print_status "Setting up Let's Encrypt certificates..."
        
        # Check if certbot is installed
        if ! command -v certbot &> /dev/null; then
            print_status "Installing Certbot..."
            
            if [[ "$OSTYPE" == "linux-gnu"* ]]; then
                # Ubuntu/Debian
                if command -v apt-get &> /dev/null; then
                    sudo apt-get update
                    sudo apt-get install -y certbot python3-certbot-nginx
                # CentOS/RHEL
                elif command -v yum &> /dev/null; then
                    sudo yum install -y certbot python3-certbot-nginx
                # Fedora
                elif command -v dnf &> /dev/null; then
                    sudo dnf install -y certbot python3-certbot-nginx
                else
                    print_error "Unsupported Linux distribution. Please install certbot manually."
                    exit 1
                fi
            elif [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                if command -v brew &> /dev/null; then
                    brew install certbot
                else
                    print_error "Homebrew not found. Please install certbot manually."
                    exit 1
                fi
            else
                print_error "Unsupported operating system. Please install certbot manually."
                exit 1
            fi
        fi

        print_status "Obtaining SSL certificates for domains..."
        
        # Stop nginx if running
        print_status "Stopping nginx if running..."
        sudo systemctl stop nginx 2>/dev/null || true
        docker stop esports_nginx_prod 2>/dev/null || true

        # Obtain certificates
        sudo certbot certonly --standalone \
            -d $DOMAIN \
            -d www.$DOMAIN \
            -d $API_DOMAIN \
            -d $ADMIN_DOMAIN \
            -d $MONITORING_DOMAIN \
            --email $EMAIL \
            --agree-tos \
            --non-interactive \
            --expand

        # Copy certificates to SSL directory
        print_status "Copying certificates to SSL directory..."
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/
        sudo chown $USER:$USER $SSL_DIR/*.pem

        # Generate DH parameters
        print_status "Generating DH parameters (this may take a while)..."
        openssl dhparam -out $SSL_DIR/dhparam.pem 2048

        # Setup auto-renewal
        print_status "Setting up automatic certificate renewal..."
        (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'docker restart esports_nginx_prod'") | sudo crontab -

        print_success "Let's Encrypt certificates installed successfully!"
        ;;

    2)
        print_status "Generating self-signed certificates..."
        
        # Generate private key
        openssl genrsa -out $SSL_DIR/privkey.pem 2048
        
        # Generate certificate signing request
        openssl req -new -key $SSL_DIR/privkey.pem -out $SSL_DIR/cert.csr -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=$DOMAIN"
        
        # Generate self-signed certificate
        openssl x509 -req -days 365 -in $SSL_DIR/cert.csr -signkey $SSL_DIR/privkey.pem -out $SSL_DIR/fullchain.pem
        
        # Generate DH parameters
        openssl dhparam -out $SSL_DIR/dhparam.pem 2048
        
        # Clean up
        rm $SSL_DIR/cert.csr
        
        print_success "Self-signed certificates generated successfully!"
        print_warning "Note: Self-signed certificates will show security warnings in browsers."
        ;;

    3)
        print_status "Using existing certificates..."
        
        if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
            print_error "Certificate files not found in $SSL_DIR/"
            print_status "Please place your certificate files:"
            print_status "  - fullchain.pem (certificate + intermediate)"
            print_status "  - privkey.pem (private key)"
            exit 1
        fi
        
        # Generate DH parameters if not exists
        if [ ! -f "$SSL_DIR/dhparam.pem" ]; then
            print_status "Generating DH parameters..."
            openssl dhparam -out $SSL_DIR/dhparam.pem 2048
        fi
        
        print_success "Existing certificates configured successfully!"
        ;;

    *)
        print_error "Invalid option selected."
        exit 1
        ;;
esac

# Set proper permissions
chmod 600 $SSL_DIR/privkey.pem
chmod 644 $SSL_DIR/fullchain.pem
chmod 644 $SSL_DIR/dhparam.pem

# Create nginx password file for monitoring
print_status "Setting up basic auth for monitoring..."
read -p "Enter username for monitoring dashboard: " monitoring_user
echo -n "Enter password for monitoring dashboard: "
read -s monitoring_password
echo

# Create htpasswd entry
echo "$monitoring_user:$(openssl passwd -apr1 $monitoring_password)" > ./nginx/.htpasswd

# SSL configuration summary
print_status "Creating SSL configuration summary..."
cat > $SSL_DIR/ssl-info.txt << EOF
SSL Configuration Summary
========================

Domain: $DOMAIN
API Domain: $API_DOMAIN
Admin Domain: $ADMIN_DOMAIN
Monitoring Domain: $MONITORING_DOMAIN

Certificate Files:
- Certificate: $SSL_DIR/fullchain.pem
- Private Key: $SSL_DIR/privkey.pem
- DH Parameters: $SSL_DIR/dhparam.pem

Certificate Information:
EOF

# Add certificate details
openssl x509 -in $SSL_DIR/fullchain.pem -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After :)" >> $SSL_DIR/ssl-info.txt

# Security recommendations
print_status "SSL Security Test Recommendations:"
echo "1. Test your SSL configuration: https://www.ssllabs.com/ssltest/"
echo "2. Check certificate transparency logs: https://crt.sh/"
echo "3. Verify HSTS implementation"
echo "4. Test all subdomains"

# Final instructions
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    SSL Setup Complete!                          ║"
echo "║                                                                  ║"
echo "║  Your SSL certificates are ready for production deployment.     ║"
echo "║                                                                  ║"
echo "║  Next steps:                                                     ║"
echo "║  1. Update DNS records to point to your server                  ║"
echo "║  2. Start production deployment: ./scripts/prod.sh              ║"
echo "║  3. Test SSL configuration                                       ║"
echo "║                                                                  ║"
echo "║  Certificate files location: $SSL_DIR/                          ║"
echo "║  Configuration summary: $SSL_DIR/ssl-info.txt                   ║"
echo "║                                                                  ║"
echo "║  Monitoring access:                                              ║"
echo "║  Username: $monitoring_user                                      ║"
echo "║  URL: https://monitoring.$DOMAIN                                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

print_success "SSL setup completed successfully!"

# Save configuration
cat > .env.ssl << EOF
# SSL Configuration
SSL_ENABLED=true
SSL_CERT_PATH=$SSL_DIR/fullchain.pem
SSL_KEY_PATH=$SSL_DIR/privkey.pem
SSL_DH_PATH=$SSL_DIR/dhparam.pem
DOMAIN=$DOMAIN
API_DOMAIN=$API_DOMAIN
ADMIN_DOMAIN=$ADMIN_DOMAIN
MONITORING_DOMAIN=$MONITORING_DOMAIN
EOF

print_status "SSL configuration saved to .env.ssl"
exit 0