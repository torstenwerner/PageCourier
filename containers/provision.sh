#!/bin/sh
set -eu
mc alias set local http://minio:9000 local-development-admin local-development-admin-password
mc mb --ignore-existing local/pagecourier-development
mc anonymous set none local/pagecourier-development
mc admin user add local local-development-app local-development-app-password
mc admin policy create local pagecourier-app /app-policy.json
mc admin policy attach local pagecourier-app --user local-development-app
