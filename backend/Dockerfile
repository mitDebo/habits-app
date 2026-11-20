# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/HabitsApp.Api/HabitsApp.Api.csproj src/HabitsApp.Api/
RUN dotnet restore src/HabitsApp.Api/HabitsApp.Api.csproj

COPY src/ src/
RUN dotnet publish src/HabitsApp.Api/HabitsApp.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

USER $APP_UID

ENTRYPOINT ["dotnet", "HabitsApp.Api.dll"]
