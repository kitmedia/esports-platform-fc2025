#!/bin/bash
# EA SPORTS FC 2025 eSports Platform - AWS Deployment Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 EA SPORTS FC 2025 - AWS Deployment${NC}"
echo "============================================"

# Configuration
REGION=${AWS_REGION:-us-east-1}
CLUSTER_NAME=${CLUSTER_NAME:-esports-platform}
SERVICE_NAME=${SERVICE_NAME:-esports-platform}
REPO_URI=${ECR_REPO_URI}
IMAGE_TAG=${IMAGE_TAG:-latest}

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure'.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Create VPC and networking
create_vpc() {
    echo -e "${YELLOW}📋 Creating VPC and networking...${NC}"
    
    aws cloudformation deploy \
        --template-file deployment/aws/vpc-template.yml \
        --stack-name ${CLUSTER_NAME}-vpc \
        --region $REGION \
        --capabilities CAPABILITY_IAM
    
    echo -e "${GREEN}✅ VPC created successfully${NC}"
}

# Create ECS cluster
create_ecs_cluster() {
    echo -e "${YELLOW}📋 Creating ECS cluster...${NC}"
    
    aws ecs create-cluster \
        --cluster-name $CLUSTER_NAME \
        --capacity-providers EC2 FARGATE \
        --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
        --region $REGION
    
    echo -e "${GREEN}✅ ECS cluster created successfully${NC}"
}

# Create ECR repositories
create_ecr_repos() {
    echo -e "${YELLOW}📋 Creating ECR repositories...${NC}"
    
    # Backend repository
    aws ecr create-repository \
        --repository-name ${CLUSTER_NAME}-backend \
        --region $REGION 2>/dev/null || echo "Backend repo already exists"
    
    # Frontend repository
    aws ecr create-repository \
        --repository-name ${CLUSTER_NAME}-frontend \
        --region $REGION 2>/dev/null || echo "Frontend repo already exists"
    
    echo -e "${GREEN}✅ ECR repositories created successfully${NC}"
}

# Build and push Docker images
build_and_push() {
    echo -e "${YELLOW}🔨 Building and pushing Docker images...${NC}"
    
    # Get ECR login
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${REPO_URI}
    
    # Build and push backend
    echo "Building backend image..."
    docker build -f docker/Dockerfile.backend -t ${CLUSTER_NAME}-backend:$IMAGE_TAG .
    docker tag ${CLUSTER_NAME}-backend:$IMAGE_TAG ${REPO_URI}/${CLUSTER_NAME}-backend:$IMAGE_TAG
    docker push ${REPO_URI}/${CLUSTER_NAME}-backend:$IMAGE_TAG
    
    # Build and push frontend
    echo "Building frontend image..."
    docker build -f docker/Dockerfile.frontend -t ${CLUSTER_NAME}-frontend:$IMAGE_TAG .
    docker tag ${CLUSTER_NAME}-frontend:$IMAGE_TAG ${REPO_URI}/${CLUSTER_NAME}-frontend:$IMAGE_TAG
    docker push ${REPO_URI}/${CLUSTER_NAME}-frontend:$IMAGE_TAG
    
    echo -e "${GREEN}✅ Images built and pushed successfully${NC}"
}

# Deploy RDS database
deploy_rds() {
    echo -e "${YELLOW}📋 Deploying RDS database...${NC}"
    
    aws cloudformation deploy \
        --template-file deployment/aws/rds-template.yml \
        --stack-name ${CLUSTER_NAME}-rds \
        --region $REGION \
        --parameter-overrides \
            ClusterName=$CLUSTER_NAME \
            DatabasePassword=$DB_PASSWORD
    
    echo -e "${GREEN}✅ RDS database deployed successfully${NC}"
}

# Deploy ElastiCache Redis
deploy_redis() {
    echo -e "${YELLOW}📋 Deploying ElastiCache Redis...${NC}"
    
    aws cloudformation deploy \
        --template-file deployment/aws/redis-template.yml \
        --stack-name ${CLUSTER_NAME}-redis \
        --region $REGION \
        --parameter-overrides ClusterName=$CLUSTER_NAME
    
    echo -e "${GREEN}✅ Redis deployed successfully${NC}"
}

# Deploy ECS services
deploy_ecs_services() {
    echo -e "${YELLOW}📋 Deploying ECS services...${NC}"
    
    aws cloudformation deploy \
        --template-file deployment/aws/ecs-services-template.yml \
        --stack-name ${CLUSTER_NAME}-services \
        --region $REGION \
        --capabilities CAPABILITY_IAM \
        --parameter-overrides \
            ClusterName=$CLUSTER_NAME \
            BackendImageUri=${REPO_URI}/${CLUSTER_NAME}-backend:$IMAGE_TAG \
            FrontendImageUri=${REPO_URI}/${CLUSTER_NAME}-frontend:$IMAGE_TAG
    
    echo -e "${GREEN}✅ ECS services deployed successfully${NC}"
}

# Setup Application Load Balancer
setup_alb() {
    echo -e "${YELLOW}📋 Setting up Application Load Balancer...${NC}"
    
    aws cloudformation deploy \
        --template-file deployment/aws/alb-template.yml \
        --stack-name ${CLUSTER_NAME}-alb \
        --region $REGION \
        --parameter-overrides ClusterName=$CLUSTER_NAME
    
    # Get ALB DNS name
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name ${CLUSTER_NAME}-alb \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text)
    
    echo -e "${GREEN}✅ Load balancer deployed: $ALB_DNS${NC}"
}

# Health check
health_check() {
    echo -e "${YELLOW}❤️  Performing health check...${NC}"
    
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name ${CLUSTER_NAME}-alb \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text)
    
    for i in {1..10}; do
        if curl -f http://$ALB_DNS/health; then
            echo -e "${GREEN}✅ Health check passed!${NC}"
            return 0
        fi
        echo "Attempt $i failed, retrying in 30s..."
        sleep 30
    done
    
    echo -e "${RED}❌ Health check failed${NC}"
    return 1
}

# Show deployment info
show_info() {
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo "============================================"
    
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name ${CLUSTER_NAME}-alb \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text)
    
    echo -e "${BLUE}📍 Access URLs:${NC}"
    echo "   Application: http://$ALB_DNS"
    echo "   API: http://$ALB_DNS/api"
    echo ""
    echo -e "${YELLOW}💡 Useful AWS commands:${NC}"
    echo "   View logs: aws logs tail /aws/ecs/${CLUSTER_NAME}"
    echo "   Scale service: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --desired-count 3"
    echo "   Stop deployment: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --desired-count 0"
}

# Main deployment flow
main() {
    case ${1:-"all"} in
        "vpc")
            check_prerequisites
            create_vpc
            ;;
        "cluster")
            check_prerequisites
            create_ecs_cluster
            ;;
        "repos")
            check_prerequisites
            create_ecr_repos
            ;;
        "build")
            check_prerequisites
            build_and_push
            ;;
        "database")
            check_prerequisites
            deploy_rds
            deploy_redis
            ;;
        "services")
            check_prerequisites
            deploy_ecs_services
            ;;
        "alb")
            check_prerequisites
            setup_alb
            ;;
        "all")
            check_prerequisites
            create_vpc
            sleep 60
            create_ecs_cluster
            create_ecr_repos
            build_and_push
            deploy_rds
            deploy_redis
            sleep 300  # Wait for database
            deploy_ecs_services
            setup_alb
            sleep 120  # Wait for services
            health_check
            show_info
            ;;
        *)
            echo "Usage: $0 [vpc|cluster|repos|build|database|services|alb|all]"
            exit 1
            ;;
    esac
}

main "$@"