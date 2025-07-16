# Google Cloud Run Deployment Guide

This guide explains how to deploy the WhatsAI application to Google Cloud Run.

## Prerequisites

1. Google Cloud account with billing enabled
2. Google Cloud SDK installed locally
3. Docker installed (optional, for local testing)
4. A Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Setup Instructions

### 1. Install Google Cloud SDK

```bash
# Download and install from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate and Set Project

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Enable Required APIs

```bash
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

## Deployment Options

### Option 1: Manual Deployment

1. **Build and test locally (optional):**
   ```bash
   docker build -t whatsai .
   docker run -p 8080:8080 whatsai
   ```

2. **Build and push to Container Registry:**
   ```bash
   # Build the image
   docker build -t gcr.io/YOUR_PROJECT_ID/whatsai .
   
   # Configure Docker to use gcloud as a credential helper
   gcloud auth configure-docker
   
   # Push the image
   docker push gcr.io/YOUR_PROJECT_ID/whatsai
   ```

3. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy whatsai \
     --image gcr.io/YOUR_PROJECT_ID/whatsai \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 8080 \
     --max-instances 10 \
     --memory 512Mi \
     --cpu 1
   ```

### Option 2: Automated Deployment with Cloud Build

1. **Set up Cloud Build trigger:**
   - Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
   - Click "Create Trigger"
   - Connect your repository
   - Set trigger to run on push to main branch
   - Use the included `cloudbuild.yaml` file

2. **Push to trigger deployment:**
   ```bash
   git add .
   git commit -m "Deploy to Cloud Run"
   git push origin main
   ```

## Environment Variables

### Setting Environment Variables in Cloud Run

1. **Via Console:**
   - Go to Cloud Run in Google Cloud Console
   - Click on your service
   - Click "Edit & Deploy New Revision"
   - Under "Variables & Secrets", add:
     - `GEMINI_API_KEY`: Your Gemini API key

2. **Via Command Line:**
   ```bash
   gcloud run services update whatsai \
     --update-env-vars GEMINI_API_KEY=your_api_key_here \
     --region us-central1
   ```

3. **Using Secret Manager (Recommended for production):**
   ```bash
   # Create a secret
   echo -n "your_api_key_here" | gcloud secrets create gemini-api-key --data-file=-
   
   # Grant Cloud Run access to the secret
   gcloud secrets add-iam-policy-binding gemini-api-key \
     --member=serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com \
     --role=roles/secretmanager.secretAccessor
   
   # Deploy with secret
   gcloud run deploy whatsai \
     --image gcr.io/YOUR_PROJECT_ID/whatsai \
     --update-secrets GEMINI_API_KEY=gemini-api-key:latest \
     --region us-central1
   ```

## Monitoring and Logs

View logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=whatsai" --limit 50
```

View metrics in Cloud Console:
- Go to Cloud Run → Select your service → Metrics tab

## Custom Domain (Optional)

1. Go to Cloud Run service in Console
2. Click "Manage Custom Domains"
3. Add your domain and follow verification steps

## Cost Optimization

- Cloud Run charges only for actual usage
- Set maximum instances to control costs
- Use Cloud Scheduler to warm up instances if needed
- Monitor usage in Cloud Console

## Troubleshooting

1. **Build failures:**
   - Check Cloud Build logs
   - Ensure all dependencies are in package.json
   - Verify Dockerfile syntax

2. **Runtime errors:**
   - Check Cloud Run logs
   - Verify environment variables are set
   - Check memory/CPU limits

3. **API key issues:**
   - Ensure GEMINI_API_KEY is set correctly
   - Check API key validity
   - Verify API quota limits

## Security Best Practices

1. Never commit API keys to source control
2. Use Secret Manager for sensitive data
3. Enable Cloud Audit Logs
4. Set up Identity and Access Management (IAM) properly
5. Consider using Cloud Armor for DDoS protection

## Support

For issues specific to:
- Google Cloud Run: [Cloud Run Documentation](https://cloud.google.com/run/docs)
- Gemini API: [Google AI Documentation](https://ai.google.dev/) 