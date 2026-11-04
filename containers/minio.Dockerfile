FROM --platform=$BUILDPLATFORM golang:1.26-bookworm@sha256:23ce71337b726608afb1bc00986e630a05034a87a87ea1fc2cd1ae5cf33387eb AS source
ARG TARGETOS
ARG TARGETARCH
ENV CGO_ENABLED=0

FROM source AS server-build
RUN git clone https://github.com/minio/minio.git /source && \
    cd /source && git checkout 9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
WORKDIR /source
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -o /minio .

FROM source AS client-build
RUN git clone https://github.com/minio/mc.git /source && \
    cd /source && git checkout d6541ea280b73a834b64d4097e21f2be77676104
WORKDIR /source
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -o /mc .

FROM alpine:3.23@sha256:ff7f0c727dd796aa36787bfcd9a64bf35a6ce72a73451b3359fde849b6703d63 AS server
LABEL org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.revision="9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
COPY --from=server-build /minio /usr/local/bin/minio
COPY --from=server-build /source/LICENSE /licenses/minio-LICENSE
RUN mkdir /data && chown 1000:1000 /data
ENV HOME=/tmp
USER 1000:1000
ENTRYPOINT ["minio"]

FROM alpine:3.23@sha256:ff7f0c727dd796aa36787bfcd9a64bf35a6ce72a73451b3359fde849b6703d63 AS client
LABEL org.opencontainers.image.source="https://github.com/minio/mc" \
      org.opencontainers.image.revision="d6541ea280b73a834b64d4097e21f2be77676104" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
COPY --from=client-build /mc /usr/local/bin/mc
COPY --from=client-build /source/LICENSE /licenses/mc-LICENSE
ENV HOME=/tmp
USER 1000:1000
ENTRYPOINT ["mc"]
