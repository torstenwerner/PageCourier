#!/usr/bin/env bash
set -euo pipefail

chart_dir="charts/pagecourier"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

helm lint "$chart_dir" --values "$chart_dir/examples/none.yaml"
chart_version="$(helm show chart "$chart_dir" | awk '$1 == "version:" { print $2 }')"
chart_app_version="$(helm show chart "$chart_dir" | awk '$1 == "appVersion:" { print $2 }')"
package_version="$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")"
if [[ "$chart_app_version" != "$package_version" ]]; then
  printf 'Chart appVersion %s does not match package image version %s\n' \
    "$chart_app_version" "$package_version" >&2
  exit 1
fi
helm package "$chart_dir" --destination "$tmp_dir" >/dev/null
package_path="$tmp_dir/pagecourier-$chart_version.tgz"
test -s "$package_path"
helm show chart "$package_path" | grep -q "^version: $chart_version$"
helm show chart "$package_path" | grep -q "^appVersion: $chart_app_version$"

for mode in none ingress gateway istio; do
  values="$chart_dir/examples/$mode.yaml"
  rendered="$tmp_dir/$mode.yaml"
  helm template pagecourier "$chart_dir" --values "$values" >"$rendered"

  grep -q '^kind: Deployment$' "$rendered"
  grep -q '^kind: Service$' "$rendered"
  grep -q 'readOnlyRootFilesystem: true' "$rendered"
  grep -q 'runAsNonRoot: true' "$rendered"
  grep -q 'path: /health/live' "$rendered"
  grep -q 'path: /health/ready' "$rendered"

  case "$mode" in
    none) expected_kind="" ;;
    ingress) expected_kind="Ingress" ;;
    gateway) expected_kind="HTTPRoute" ;;
    istio) expected_kind="VirtualService" ;;
  esac

  for kind in Ingress HTTPRoute VirtualService; do
    if [[ "$kind" == "$expected_kind" ]]; then
      grep -q "^kind: $kind$" "$rendered"
    elif grep -q "^kind: $kind$" "$rendered"; then
      printf 'Unexpected %s resource rendered for %s mode\n' "$kind" "$mode" >&2
      exit 1
    fi
  done
done

if helm template pagecourier "$chart_dir" --values "$chart_dir/examples/none.yaml" \
  --set exposure.mode=invalid >"$tmp_dir/invalid.log" 2>&1; then
  printf 'Invalid exposure mode was accepted\n' >&2
  exit 1
fi
grep -q "value must be one of 'none', 'ingress', 'gateway', 'istio'" "$tmp_dir/invalid.log"

if helm template pagecourier "$chart_dir" --values "$chart_dir/examples/none.yaml" \
  --set exposure.mode=gateway >"$tmp_dir/missing-parent.log" 2>&1; then
  printf 'Gateway mode without parentRefs was accepted\n' >&2
  exit 1
fi
grep -q 'parentRefs' "$tmp_dir/missing-parent.log"

if helm template pagecourier "$chart_dir" --values "$chart_dir/examples/none.yaml" \
  --set exposure.mode=istio >"$tmp_dir/missing-istio-gateway.log" 2>&1; then
  printf 'Istio mode without hosts and gateways was accepted\n' >&2
  exit 1
fi
grep -q '/exposure/istio/gateways' "$tmp_dir/missing-istio-gateway.log"

if helm template pagecourier "$chart_dir" --values "$chart_dir/examples/none.yaml" \
  --set exposure.mode=ingress --set-json exposure.ingress.hosts=[] \
  >"$tmp_dir/missing-ingress-host.log" 2>&1; then
  printf 'Ingress mode without hosts was accepted\n' >&2
  exit 1
fi
grep -q '/exposure/ingress/hosts' "$tmp_dir/missing-ingress-host.log"

if helm template pagecourier "$chart_dir" --values "$chart_dir/examples/none.yaml" \
  --set image.digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --set image.tag=0.0.1 >"$tmp_dir/conflicting-image.log" 2>&1; then
  printf 'Conflicting image tag and digest were accepted\n' >&2
  exit 1
fi

if helm template pagecourier "$chart_dir" --values "$chart_dir/examples/none.yaml" \
  --set-json 'extraEnv=[{"name":"NODE_ENV","value":"development"}]' \
  >"$tmp_dir/reserved-env.log" 2>&1; then
  printf 'Chart-managed runtime environment override was accepted\n' >&2
  exit 1
fi
grep -q 'cannot override chart-managed environment variable' "$tmp_dir/reserved-env.log"

helm template pagecourier "$chart_dir" --values "$chart_dir/examples/aws-workload-identity.yaml" \
  >"$tmp_dir/workload-identity.yaml"
grep -q 'eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/pagecourier' "$tmp_dir/workload-identity.yaml"

helm template pagecourier "$chart_dir" --values "$chart_dir/examples/external-secret.yaml" \
  >"$tmp_dir/external-secret.yaml"
grep -q 'name: pagecourier-storage-credentials' "$tmp_dir/external-secret.yaml"

helm template pagecourier "$chart_dir" \
  --values "$chart_dir/examples/none.yaml" \
  --set image.tag=1.2.3 >"$tmp_dir/image-tag.yaml"
grep -q 'ghcr.io/torstenwerner/pagecourier:1.2.3' "$tmp_dir/image-tag.yaml"

helm template pagecourier "$chart_dir" \
  --values "$chart_dir/examples/none.yaml" \
  --set image.digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa >"$tmp_dir/image-digest.yaml"
grep -q 'ghcr.io/torstenwerner/pagecourier@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' "$tmp_dir/image-digest.yaml"

printf 'Helm lint, package, exposure-mode renders, invalid values, and image selection passed.\n'
